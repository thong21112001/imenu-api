const mongoose = require('mongoose');

async function cleanup() {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/imenu-db';
  console.log(`Kết nối MongoDB tại: ${mongoUrl}...`);
  await mongoose.connect(mongoUrl);
  const db = mongoose.connection.db;

  // 1. Xóa các tài khoản kiểm thử cũ
  const userResult = await db.collection('users').deleteMany({
    $or: [
      { email: { $regex: /^test\.owner\./i } },
      { username: { $regex: /^test\.owner\./i } },
    ],
  });
  console.log(`🧹 Đã xóa ${userResult.deletedCount} tài khoản người dùng kiểm thử rác.`);

  // 2. Xóa các nhà hàng kiểm thử cũ
  const restResult = await db.collection('restaurants').deleteMany({
    $or: [
      { slug: { $regex: /^bep-nha-sai-gon-/i } },
      { name: { $regex: /^Bếp Nhà Sài Gòn/i } },
    ],
  });
  console.log(`🧹 Đã xóa ${restResult.deletedCount} nhà hàng kiểm thử rác.`);

  // Kiểm tra số lượng còn lại
  const remainingUsers = await db.collection('users').find({}, { projection: { email: 1, username: 1, role: 1 } }).toArray();
  const remainingRests = await db.collection('restaurants').find({}, { projection: { name: 1, slug: 1 } }).toArray();

  console.log(`\n✅ Dữ liệu chuẩn còn lại trong Database:`);
  console.log('   - Users:', remainingUsers.map((u) => `${u.username} (${u.email})`));
  console.log('   - Restaurants:', remainingRests.map((r) => `${r.name} (${r.slug})`));

  await mongoose.disconnect();
  console.log('Hoàn tất dọn dẹp!');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Lỗi khi dọn dẹp:', err);
  process.exit(1);
});
