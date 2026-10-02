const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const buffer = fs.readFileSync('package.json');
  const { data, error } = await supabase.storage.from('avatars').upload('test.json', buffer, { upsert: true });
  console.log('Upload result:', data, error);
}
run();
