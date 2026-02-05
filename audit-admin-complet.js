const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/restauconnect';

mongoose.connect(uri).then(async () => {
  console.log('\n=== AUDIT COMPLETS ADMIN/SUPER_ADMIN ===\n');
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  
  // 1. Comptes admin/super_admin
  const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } })
    .select('email role name isActive verified status createdAt')
    .lean();
  
  console.log('1. COMPTES ADMIN/SUPER_ADMIN EN BASE:');
  if (admins.length === 0) {
    console.log('   ❌ AUCUN compte admin trouvé !');
    console.log('   → Il faut créer des comptes admin\n');
  } else {
    admins.forEach((u, i) => {
      console.log(`\n   ${i+1}. ${u.email}`);
      console.log(`      Role: ${u.role}`);
      console.log(`      Name: ${u.name || 'N/A'}`);
      console.log(`      Active: ${u.isActive !== false ? 'OUI' : 'NON'}`);
      console.log(`      Verified: ${u.verified ? 'OUI' : 'NON'}`);
      console.log(`      Status: ${u.status || 'N/A'}`);
      console.log(`      Créé le: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : 'N/A'}`);
    });
  }
  
  // 2. Tous les rôles présents
  console.log('\n\n2. TOUS LES RÔLES PRÉSENTS EN BASE:');
  const roleStats = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  roleStats.forEach(r => {
    console.log(`   - ${r._id}: ${r.count} utilisateur(s)`);
  });
  
  // 3. Vérifier les utilisateurs avec status pending
  console.log('\n\n3. UTILISATEURS EN ATTENTE D\'APPROBATION:');
  const pending = await User.find({ status: 'pending' })
    .select('email role name createdAt')
    .lean();
  
  if (pending.length === 0) {
    console.log('   ✅ Aucun utilisateur en attente');
  } else {
    pending.forEach((u, i) => {
      console.log(`   ${i+1}. ${u.email} (${u.role}) - Créé le ${new Date(u.createdAt).toLocaleDateString('fr-FR')}`);
    });
  }
  
  // 4. Audit logs
  const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }), 'auditlogs');
  const auditCount = await AuditLog.countDocuments();
  
  console.log(`\n\n4. AUDIT LOGS:`);
  console.log(`   Total logs: ${auditCount}`);
  
  if (auditCount > 0) {
    const recentLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('action performedByEmail targetType createdAt')
      .lean();
    
    console.log(`\n   5 dernières actions:`);
    recentLogs.forEach((log, i) => {
      console.log(`   ${i+1}. ${log.action} par ${log.performedByEmail || 'N/A'} - ${new Date(log.createdAt).toLocaleString('fr-FR')}`);
    });
  }
  
  console.log('\n\n=== FIN AUDIT ===\n');
  process.exit(0);
  
}).catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
