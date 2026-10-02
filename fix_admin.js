const fs = require('fs');
let content = fs.readFileSync('app/admin/page.tsx', 'utf8');

const tSound = "sound: serviceRegs.filter((r: any) => r.team === 'SOUND').map((r: any) => users.find((u: any) => u.id === r.user_id)).filter(Boolean),";
const tSinger = "singer: serviceRegs.filter((r: any) => r.team === 'SINGER').map((r: any) => users.find((u: any) => u.id === r.user_id)).filter(Boolean),";
const tMusician = "musician: serviceRegs.filter((r: any) => r.team === 'MUSICIAN').map((r: any) => users.find((u: any) => u.id === r.user_id)).filter(Boolean),";

const rSound = "sound: serviceRegs.filter((r: any) => r.team === 'SOUND').map((r: any) => { const u = users.find((u: any) => u.id === r.user_id); return u ? { ...u, role_detail: r.role_detail } : null; }).filter(Boolean),";
const rSinger = "singer: serviceRegs.filter((r: any) => r.team === 'SINGER').map((r: any) => { const u = users.find((u: any) => u.id === r.user_id); return u ? { ...u, role_detail: r.role_detail } : null; }).filter(Boolean),";
const rMusician = "musician: serviceRegs.filter((r: any) => r.team === 'MUSICIAN').map((r: any) => { const u = users.find((u: any) => u.id === r.user_id); return u ? { ...u, role_detail: r.role_detail } : null; }).filter(Boolean),";

content = content.replace(tSound, rSound);
content = content.replace(tSinger, rSinger);
content = content.replace(tMusician, rMusician);

fs.writeFileSync('app/admin/page.tsx', content);
