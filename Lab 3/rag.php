<?php
require 'vendor/autoload.php';
$apiKey = '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';
$client = OpenAI::client($apiKey);

function cosineSimilarity(array $vec1, array $vec2)
{
  $dotProduct = 0;
  $magnitude1 = 0;
  $magnitude2 = 0;

  foreach ($vec1 as $key => $value) {
    $dotProduct += $value * $vec2[$key];
    $magnitude1 += $value * $value;
    $magnitude2 += $vec2[$key] * $vec2[$key];
  }

  if ($magnitude1 * $magnitude2 == 0) return 0;

  return $dotProduct / (sqrt($magnitude1) * sqrt($magnitude2));
}

function getEmbedding($client, $text)
{
  $response = $client->embeddings()->create([
    'model' => 'text-embedding-3-small',
    'input' => $text,
  ]);
  return $response->embeddings[0]->embedding;
}

echo "1. Loading Knowledge Base...\n";

$content = file_get_contents('knowledge.txt');
$chunks = array_filter(explode("\n", $content));

$database = [];

echo "2. Creating Embeddings (This calls OpenAI API)...\n";

try {
  foreach ($chunks as $chunk) {
    if (trim($chunk) == "") continue;

    $vector = getEmbedding($client, $chunk);

    $database[] = [
      'text' => $chunk,
      'vector' => $vector
    ];
    echo ".";
  }
  echo "\nDone!\n";
} catch (Exception $e) {
  die("\n Error creating embeddings: " . $e->getMessage() . "\n(Check your Quota/Credit)\n");
}


$userQuery = "مين هو المدير ومتى تأسست الشركة؟";
echo "\nUser Question: $userQuery\n";

echo "3. Searching for relevant info...\n";

$queryVector = getEmbedding($client, $userQuery);

$bestMatch = null;
$highestScore = -1;

foreach ($database as $item) {
  $score = cosineSimilarity($queryVector, $item['vector']);


  if ($score > $highestScore) {
    $highestScore = $score;
    $bestMatch = $item['text'];
  }
}

if ($highestScore < 0.4) {
  $context = "No relevant context found.";
} else {
  $context = $bestMatch;
}

echo " Best Context Found: \"$context\" (Score: " . round($highestScore, 2) . ")\n";


echo "4. Generating Answer via GPT-4o-mini...\n";

$messages = [
  ['role' => 'system', 'content' => 'You are a helpful assistant. Answer the question based ONLY on the provided context.'],
  ['role' => 'user', 'content' => "Context: $context\n\nQuestion: $userQuery"],
];

$response = $client->chat()->create([
  'model' => 'gpt-4o-mini',
  'messages' => $messages,
]);

echo "🤖 AI Answer:\n";
echo $response->choices[0]->message->content . "\n";