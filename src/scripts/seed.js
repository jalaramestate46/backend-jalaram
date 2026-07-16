const bcrypt = require('bcryptjs');
const { supabase, isConfigured } = require('../config/supabaseClient');
const { fallbacks } = require('../controllers/contentController');

const seed = async () => {
  console.log("Starting database seeding process...");

  if (!isConfigured) {
    console.error("ERROR: Cannot seed database. Supabase is not configured in backend/.env.");
    process.exit(1);
  }

  try {
    // 1. Seed Administrator User
    console.log("Checking administrative account...");
    const adminEmail = 'admin@jalaram.com';
    const adminUsername = 'admin';

    const { data: existingAdmin, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle();

    if (findError) throw findError;

    if (!existingAdmin) {
      console.log("Admin account not found. Creating default administrator...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      const { data: newAdmin, error: insertError } = await supabase
        .from('users')
        .insert({
          username: adminUsername,
          full_name: 'Jalaram Administrator',
          email: adminEmail,
          password: hashedPassword,
          mobile: '9898082218',
          role: 'admin'
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      console.log(`Successfully created default admin user. Email: ${adminEmail}, Password: admin123`);
    } else {
      console.log("Admin account already exists. Skipping user seed.");
    }

    // 2. Seed Default Site Contents
    console.log("Seeding default site content records...");
    for (const [sectionKey, fallbackValue] of Object.entries(fallbacks)) {
      console.log(`Processing site section: '${sectionKey}'...`);

      const { data: existingSection } = await supabase
        .from('site_content')
        .select('id')
        .eq('id', sectionKey)
        .maybeSingle();

      if (!existingSection) {
        const { error: contentInsertError } = await supabase
          .from('site_content')
          .insert({
            id: sectionKey,
            data: fallbackValue
          });

        if (contentInsertError) throw contentInsertError;
        console.log(`Successfully seeded '${sectionKey}' content.`);
      } else {
        console.log(`Site content for '${sectionKey}' already exists. Skipping.`);
      }
    }

    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Critical error during database seeding:", error.message);
    process.exit(1);
  }
};

seed();
