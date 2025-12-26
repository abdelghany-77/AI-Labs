<?php

require 'vendor/autoload.php';

$apiKey = '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';

$client = OpenAI::client($apiKey);

try {
  echo "1. Uploading file...\n";

  if (!file_exists('training_data.jsonl')) {
    die("Error: File 'training_data.jsonl' not found in the same directory.\n");
  }

  $response = $client->files()->upload([
    'purpose' => 'fine-tune',
    'file' => fopen('training_data.jsonl', 'r'),
  ]);

  $fileId = $response->id;
  echo "File Uploaded Successfully! ID: " . $fileId . "\n";

  echo "2. Starting Fine-tuning job (waiting 10 seconds for file processing)...\n";

  sleep(10);

  $job = $client->fineTuning()->createJob([
    'training_file' => $fileId,
    'model' => 'gpt-4o-mini-2024-07-18'
  ]);

  echo "Success! Job Started.\n";
  echo "Job ID: " . $job->id . "\n";
  echo "Status: " . $job->status . "\n";
} catch (Exception $e) {
  echo "\n!!!!!!!!!!!!!! ERROR !!!!!!!!!!!!!!\n";
  echo "Message: " . $e->getMessage() . "\n";
  echo "If the error is 401, check your API Key.\n";
}