const bcrypt = require('bcryptjs');

(async () => {
  await bcrypt.hash('admin123', 10);
  await bcrypt.hash('super123', 10);
  await bcrypt.hash('guard123', 10);
})();
