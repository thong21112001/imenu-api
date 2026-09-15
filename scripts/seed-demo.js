const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/imenu-db');
  const db = mongoose.connection.db;

  const role = await db.collection('roles').findOne({ slug: 'restaurant_admin' });
  if (!role) {
    console.log('Role restaurant_admin not found');
    process.exit(1);
  }

  let rest = await db.collection('restaurants').findOne({ slug: 'bep-nha' });
  if (!rest) {
    const mainBranchId = new mongoose.Types.ObjectId();
    const res = await db.collection('restaurants').insertOne({
      name: 'Bếp Nhà - Ẩm Thực Việt',
      slug: 'bep-nha',
      phone: '0901234567',
      address: '123 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM',
      tagline: 'Hương vị gia đình, trọn vẹn từng khoảnh khắc',
      bankAccount: {
        bankId: 'MB',
        bankName: 'MBBank',
        accountNo: '0901234567',
        accountName: 'NGUYEN MINH AN',
        template: 'compact',
      },
      isOpen: true,
      openingHours: '08:00 - 22:30',
      plan: 'Pro',
      branches: [
        {
          _id: mainBranchId,
          name: 'Chi nhánh Quận 1',
          address: '123 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM',
          phone: '0901234567',
          isMainBranch: true,
          isActive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    rest = await db.collection('restaurants').findOne({ _id: res.insertedId });
  }

  const branch = rest.branches[0];
  const hash = await bcrypt.hash('Demo@123', 10);

  await db.collection('users').updateOne(
    { email: 'owner@sample.vn' },
    {
      $set: {
        username: 'owner',
        email: 'owner@sample.vn',
        password: hash,
        fullName: 'Nguyễn Minh An',
        phone: '0901234567',
        role: role._id,
        restaurantId: rest._id,
        branchId: branch._id.toString(),
        branchName: branch.name,
        isRoleActive: true,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  console.log('✅ Successfully seeded owner@sample.vn / Demo@123 for restaurant Bếp Nhà');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
