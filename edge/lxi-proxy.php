<?php
declare(strict_types=1);

/*
  Steamix TV taskyicisi (LXI.be ucretsiz hosting, Almanya cikisi).

  Saglayicinin ham http video kutulari tarayiciya dogrudan verilemez: sayfamiz https, kutu
  http. Bu dosya kutudan aldigi baytlari kendi adresinden https olarak geri verir; yani
  video senin hostinginden akar ve Render kotandan hicbir bayt dusmez.

  Sozlesme Render'in kapisiyla birebir aynidir (ayni imza, ayni anahtar): worker tek imza ile
  istersen buraya, istersen Render'a yollar. Anahtari degistirmek icin tek satir asagida.
  Bulut cikisina karsi korunur: yalnizca saglayicinin rakip-IP kutulari ve kendi geil
  adresleri tasinir; burasi acik proxy degildir.
*/

const SECRET = 'notflix-geil-proxy-v1-7c4f2a9e';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
const CHILD_TTL = 8 * 3600 * 1000;

@set_time_limit(0);
@ini_set('zlib.output_compression', '0');
while (ob_get_level() > 0) { ob_end_flush(); }

function b64(string $raw): string { return rtrim(strtr(base64_encode($raw), '+/', '-_'), '='); }
function unb64(string $s): string { $p = strlen($s) % 4; if ($p) { $s .= str_repeat('=', 4 - $p); } return (string) base64_decode(strtr($s, '-_', '+/'), true); }
function sign(array $payload): string
{
    $data = b64((string) json_encode($payload));
    return $data . '.' . b64(hash_hmac('sha256', $data, SECRET, true));
}
function verify(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 2) { return null; }
    [$data, $sig] = $parts;
    if (!hash_equals(b64(hash_hmac('sha256', $data, SECRET, true)), $sig)) { return null; }
    $payload = json_decode(unb64($data), true);
    if (!is_array($payload)) { return null; }
    if (isset($payload['exp']) && (int) $payload['exp'] < (int) (microtime(true) * 1000)) { return null; }
    return $payload;
}
function deny(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    exit($message);
}
function selfUrl(): string
{
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'notflixlive.lxi.be');
    return 'https://' . $host . '/' . basename((string) ($_SERVER['SCRIPT_NAME'] ?? 's.php'));
}
/** Parca adresleri bu dosyanin kendi https adresine yazilir; tarayici bir daha ham http istemez. */
function proxify(string $absolute, ?array $headers): string
{
    $payload = ['u' => $absolute, 'exp' => (int) (microtime(true) * 1000) + CHILD_TTL];
    if ($headers && $headers !== []) { $payload['h'] = $headers; }
    return selfUrl() . '?t=' . urlencode(sign($payload));
}
function resolve(string $line, string $base): string
{
    if (preg_match('~^https?://~i', $line)) { return $line; }
    $p = parse_url($base);
    $root = ($p['scheme'] ?? 'http') . '://' . ($p['host'] ?? '') . (isset($p['port']) ? ':' . $p['port'] : '');
    if ($line !== '' && $line[0] === '/') { return $root . $line; }
    $dir = isset($p['path']) ? (string) preg_replace('~/[^/]*$~', '/', $p['path']) : '/';
    return $root . $dir . $line;
}
/** bant listesindeki her adresi (parca satlari + #EXT-X-...-URI) taskyak; satiri oldugu gibi birakmaz. */
function rewrite(string $text, string $base, ?array $headers): string
{
    $out = [];
    foreach (preg_split('~\r?\n~', $text) as $line) {
        $t = trim($line);
        if ($t === '') { $out[] = $line; continue; }
        if ($t[0] === '#') {
            $out[] = preg_replace_callback('~URI="([^"]+)"~', static function (array $m) use ($base, $headers): string {
                return 'URI="' . proxify(resolve($m[1], $base), $headers) . '"';
            }, $line);
            continue;
        }
        $out[] = proxify(resolve($t, $base), $headers);
    }
    return implode("\n", $out);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: range, if-range, content-type');
    header('Access-Control-Expose-Headers: content-range, accept-ranges, content-type');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

$token = (string) ($_GET['t'] ?? '');
if ($token === '') { deny(400, 't eksik'); }
$payload = verify($token);
if (!$payload) { deny(401, 'Imza gecersiz veya suresi dolmus'); }

$target = (string) ($payload['u'] ?? '');
if (!preg_match('~^https?://~i', $target)) { deny(400, 'Adres gecersiz'); }
$host = (string) (parse_url($target, PHP_URL_HOST) ?: '');

/* Askina proxy olmassin: kapıyı yalnızca bizim sunucumuzun imzası açar; imzasız hiçbir adres
   geçmez. Ek tedbir olarak kendi iç adreslerimize giden istekler reddedilir. Eski sistemin
   kutuları (mclanx, ctn34) yeni film yolunda hiç yok. */
$ipv4 = filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4);
if ($ipv4 !== false && filter_var($ipv4, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
    deny(403, 'Ic adres taskinamaz');
}
if (preg_match('~^(?:localhost$|.+\.local$|127\.|10\.|192\.168\.|169\.254\.|0\.)~i', $host)) {
    deny(403, 'Ic adres taskinamaz');
}

$extra = $payload['h'] ?? [];
$hd = [
    'User-Agent: ' . (string) (($extra['user-agent'] ?? '') ?: UA),
    'Accept: */*',
    'Origin: https://geil.to',
    'Referer: ' . (string) (($extra['referer'] ?? '') ?: 'https://geil.to/'),
];
if (!empty($extra['cookie'])) { $hd[] = 'Cookie: ' . (string) $extra['cookie']; }
foreach ($extra as $k => $v) {
    $lk = strtolower((string) $k);
    if (in_array($lk, ['user-agent', 'accept', 'origin', 'referer', 'cookie'], true) || $v === '') { continue; }
    $hd[] = $lk . ': ' . (string) $v;
}
/* Tarayici ararken 'bytes=1048576-' gibi sonu acik adres yollar; eskiden sadece iki yazi
   arasini kabul ediyordu, o yuzden sarma hep bastan iniyordu. */
$wantRange = isset($_SERVER['HTTP_RANGE']) && preg_match('~^bytes=\d*-\d*$~', (string) $_SERVER['HTTP_RANGE']);
if ($wantRange) { $hd[] = 'Range: ' . (string) $_SERVER['HTTP_RANGE']; }

$seen = ['status' => 0, 'type' => '', 'range' => '', 'url' => $target];
$sent = false;
$buffer = '';
$isPlaylist = false;

$onHeader = static function ($ch, string $line) use (&$seen, &$isPlaylist): int {
    if (preg_match('~^HTTP/\S+\s+(\d{3})~', $line, $m)) {
        $seen['status'] = (int) $m[1];
        $seen['type'] = '';
        $seen['range'] = '';
        $isPlaylist = false;
        return strlen($line);
    }
    if (preg_match('~^content-type:\s*(.+)\s*$~i', $line, $m)) { $seen['type'] = trim($m[1]); return strlen($line); }
    if (preg_match('~^content-range:\s*(.+)\s*$~i', $line, $m)) { $seen['range'] = trim($m[1]); return strlen($line); }
    if (preg_match('~^location:\s*(.+)\s*$~i', $line, $m)) {
        $seen['url'] = resolve(trim($m[1]), $seen['url']);
        $isPlaylist = false;
        return strlen($line);
    }
    if ($line === "\r\n" || $line === "\n") {
        $isPlaylist = stripos($seen['type'], 'mpegurl') !== false
            || preg_match('~\.m3u8?(\?|$)~i', (string) (parse_url($seen['url'], PHP_URL_PATH) ?: ''));
    }
    return strlen($line);
};

$emit = static function () use (&$seen, &$isPlaylist, &$sent): void {
    if ($sent) { return; }
    $sent = true;
    /* kutu parca verdiyse biz de parca diyoruz; 200'e cevrilirse oyuncu uzunlugu sasirir */
    if ($seen['status'] === 206) { http_response_code(206); }
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: range, if-range, content-type');
    header('Access-Control-Expose-Headers: content-range, accept-ranges, content-type');
    header('Cache-Control: no-store');
    header('X-Stream-From: lxi');
    header('Content-Type: ' . ($isPlaylist ? 'application/vnd.apple.mpegurl' : ($seen['type'] !== '' ? $seen['type'] : 'application/octet-stream')));
    if ($seen['range'] !== '') { header('Content-Range: ' . $seen['range']); header('Accept-Ranges: bytes'); }
    if (!$isPlaylist && preg_match('~video/MP2T|mp2t~i', $seen['type'])) { header('Content-Disposition: inline; filename="seg.ts"'); }
};

$onBody = static function ($ch, string $chunk) use (&$buffer, &$isPlaylist, &$seen, &$sent, $emit): int {
    /* kutu liste adresine application/octet-stream diye cevap verebiliyor: govde #EXTM3U
       ile basiyorsa onu yine de liste say ve hicbir seyi disari akitmadan yeniden yaz. */
    if (!$isPlaylist && !$sent && $buffer === '' && strncmp($chunk, '#EXT', 4) === 0) {
        $isPlaylist = true;
        $seen['type'] = 'application/vnd.apple.mpegurl';
    }
    if ($isPlaylist) { $buffer .= $chunk; return strlen($chunk); }
    $emit();
    echo $chunk;
    return strlen($chunk);
};

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_LOW_SPEED_LIMIT => 1024,
    CURLOPT_LOW_SPEED_TIME => 30,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_HTTPHEADER => $hd,
    CURLOPT_HEADERFUNCTION => $onHeader,
    CURLOPT_WRITEFUNCTION => $onBody,
]);

$ok = curl_exec($ch);
$errNo = curl_errno($ch);
curl_close($ch);

if ($seen['status'] >= 400) { deny($seen['status'] === 404 ? 404 : ($seen['status'] === 403 ? 403 : 502), 'Kutu ' . $seen['status'] . ' dedi'); }
if ($ok === false && $buffer === '' && !$sent) { deny(502, $errNo ? 'Kutuya ulasilamadi (curl ' . $errNo . ')' : 'Kutuya ulasilamadi'); }

if ($isPlaylist) {
    $emit();
    echo rewrite($buffer, $seen['url'], $payload['h'] ?? null);
    exit;
}
