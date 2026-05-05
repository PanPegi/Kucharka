<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$file = 'recepty.json';

if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    echo json_encode([]);
}
?>  