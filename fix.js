const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/s\.role_detail \? \ \(\)\ : s\.user_name/g, 's.role_detail ? ` ()` : s.user_name');
  content = content.replace(/s\.role_detail \? \\$\{s\.user_name\} \(\)\ : s\.user_name/g, 's.role_detail ? ` ()` : s.user_name');
  fs.writeFileSync(filePath, content);
}

fixFile('app/schedule/ClientSchedule.tsx');
fixFile('app/admin/AdminDashboardClient.tsx');
