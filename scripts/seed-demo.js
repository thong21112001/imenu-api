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

  const sampleAccounts = [
    {
      username: 'owner',
      email: 'owner@sample.vn',
      fullName: 'Nguyễn Minh An',
      phone: '0901234567',
      roleSlug: 'restaurant_admin',
    },
    {
      username: 'manager',
      email: 'manager@sample.vn',
      fullName: 'Trần Quốc Bảo',
      phone: '0902345678',
      roleSlug: 'restaurant_manager',
    },
    {
      username: 'cashier',
      email: 'cashier@sample.vn',
      fullName: 'Lê Thu Thảo',
      phone: '0903456789',
      roleSlug: 'cashier',
    },
    {
      username: 'kitchen',
      email: 'kitchen@sample.vn',
      fullName: 'Hoàng Văn Bếp',
      phone: '0904567890',
      roleSlug: 'kitchen',
    },
    {
      username: 'waiter',
      email: 'waiter@sample.vn',
      fullName: 'Phạm Văn Phục',
      phone: '0905678901',
      roleSlug: 'waiter',
    },
  ];

  for (const acc of sampleAccounts) {
    const roleDoc = await db.collection('roles').findOne({ slug: acc.roleSlug });
    if (!roleDoc) {
      console.log(`Role ${acc.roleSlug} not found, skipping`);
      continue;
    }

    await db.collection('users').updateOne(
      { email: acc.email },
      {
        $set: {
          username: acc.username,
          email: acc.email,
          password: hash,
          fullName: acc.fullName,
          phone: acc.phone,
          role: roleDoc._id,
          restaurantId: rest._id,
          branchId: branch._id.toString(),
          branchName: branch.name,
          isRoleActive: true,
          status: 'ACTIVE',
          isDeleted: false,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    console.log(`✅ Seeded ${acc.email} (${acc.roleSlug}) / Demo@123`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
