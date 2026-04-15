<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Povolí požadavky z jiných domén/portů

$file = 'recepty.json';

if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    // Pokud soubor neexistuje, vrátíme prázdné pole (v JSONu [])
    echo json_encode([]);
}
?>  