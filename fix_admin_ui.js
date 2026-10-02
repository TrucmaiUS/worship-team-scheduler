const fs = require('fs');
let content = fs.readFileSync('app/admin/AdminDashboardClient.tsx', 'utf8');

content = content.replace(/\{s\.full_name\}/g, '{s.role_detail ? ${s.full_name} () : s.full_name}');

fs.writeFileSync('app/admin/AdminDashboardClient.tsx', content);
