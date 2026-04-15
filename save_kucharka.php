<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Načtení dat z POST požadavku
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data !== null) {
    $file = 'recepty.json';
    
    // JSON_PRETTY_PRINT pro čitelnost, JSON_UNESCAPED_UNICODE pro správnou češtinu
    $json_string = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    if (file_put_contents($file, $json_string, LOCK_EX)) {
        echo json_encode(["status" => "success", "message" => "Recepty uloženy"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Nelze zapsat do souboru. Zkontrolujte oprávnění (CHMOD 666)."]);
    }
} else {
    http_response_code(400);
    echo json_encode(["error" => "Neplatná data - JSON je prázdný nebo poškozený"]);
}
?>