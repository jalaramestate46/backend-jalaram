const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { supabaseAdmin, isAdminConfigured } = require('../config/supabaseClient');

const frontendPublicDir = path.join(__dirname, '../../../frontend/public');

async function uploadFile(localPath, destName, contentType) {
  if (!fs.existsSync(localPath)) {
    console.warn(`File not found at ${localPath}, trying fallback or warning...`);
    return null;
  }
  const fileBuffer = fs.readFileSync(localPath);
  console.log(`Uploading ${destName}...`);
  const { error } = await supabaseAdmin.storage
    .from('uploads')
    .upload(destName, fileBuffer, {
      contentType,
      upsert: true
    });
  if (error) {
    console.error(`Failed to upload ${destName}:`, error.message);
    return null;
  }
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('uploads')
    .getPublicUrl(destName);
  console.log(`Uploaded ${destName} -> ${publicUrl}`);
  return publicUrl;
}

async function runSeed() {
  if (!isAdminConfigured) {
    console.error("ERROR: Cannot seed. supabaseAdmin is not configured locally.");
    process.exit(1);
  }

  try {
    console.log("Seeding storage assets first...");
    
    // Upload images
    const logoUrl = await uploadFile(path.join(frontendPublicDir, 'Logo.png'), 'Logo.png', 'image/png') || '/Logo.png';
    const houseUrl = await uploadFile(path.join(frontendPublicDir, 'house.png'), 'house.png', 'image/png') || '/house.png';
    const imageUrl = await uploadFile(path.join(frontendPublicDir, 'image.png'), 'image.png', 'image/png') || '/image.png';
    
    const vaikunthImgUrl = await uploadFile(path.join(frontendPublicDir, 'projects/vaikunth-homes.webp'), 'projects/vaikunth-homes.webp', 'image/webp') || imageUrl;
    const parivaarImgUrl = await uploadFile(path.join(frontendPublicDir, 'projects/parivaar-bungalows.jpeg'), 'projects/parivaar-bungalows.jpeg', 'image/jpeg') || houseUrl;
    const sevenStreetImgUrl = await uploadFile(path.join(frontendPublicDir, 'projects/7-street-bungalows.webp'), 'projects/7-street-bungalows.webp', 'image/webp') || imageUrl;
    
    // Upload brochures
    const vaikunthPdfUrl = await uploadFile(path.join(frontendPublicDir, 'vaikunth-homes-brochure.pdf'), 'vaikunth-homes-brochure.pdf', 'application/pdf') || '#';
    const parivaarPdfUrl = await uploadFile(path.join(frontendPublicDir, 'parivaar-bungalows-brochure.pdf'), 'parivaar-bungalows-brochure.pdf', 'application/pdf') || '#';
    const sevenStreetPdfUrl = await uploadFile(path.join(frontendPublicDir, '7 Street BunglowsS.pdf'), '7 Street BunglowsS.pdf', 'application/pdf') || '#';

    // 1. Seed admin user
    console.log("Seeding administrator account...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const { data: adminUser, error: uError } = await supabaseAdmin
      .from('users')
      .upsert({
        username: 'admin',
        full_name: 'Jalaram Administrator',
        email: 'admin@jalaram.com',
        password: hashedPassword,
        mobile: '9898082218',
        role: 'admin'
      }, { onConflict: 'email' })
      .select('id')
      .single();

    if (uError) throw uError;
    const adminId = adminUser.id;
    console.log("Admin user seeded successfully.");

    // 2. Seed projects
    console.log("Seeding projects...");
    const projects = [
      {
        title: "Vaikunth Homes",
        slug: "vaikunth-homes",
        description: "A thoughtfully planned residential development designed for long-term value and comfortable family living.",
        status: "ONGOING",
        location: "Jahangirabad, Surat",
        address: "Near Jahangirabad Circle, Surat",
        project_type: "Premium Plotted Development",
        images: [vaikunthImgUrl],
        amenities: ["24/7 Security", "Clubhouse", "Children Play Area", "Jogging Track", "Water Supply"],
        brochure: vaikunthPdfUrl,
        faqs: [
          {
            question: "What is the RERA number for Vaikunth Homes?",
            answer: "Vaikunth Homes is fully registered and details can be checked under Gujarat RERA portal."
          }
        ]
      },
      {
        title: "Parivaar Bungalows",
        slug: "parivaar-bungalows",
        description: "A refined bungalow community for buyers who want better planning, stronger presentation, and a premium location.",
        status: "ONGOING",
        location: "Ugat Canal Road, Surat",
        address: "Ugat Canal Road, Surat",
        project_type: "Luxury Bungalow Community",
        images: [parivaarImgUrl],
        amenities: ["Swimming Pool", "Gymnasium", "Landscape Garden", "Senior Citizen Park"],
        brochure: parivaarPdfUrl,
        faqs: [
          {
            question: "When is the possession date?",
            answer: "Possession is expected by December 2027."
          }
        ]
      },
      {
        title: "7 Street Bungalows",
        slug: "7-street-bungalows",
        description: "A modern plotted and bungalow destination built to combine practical access with future-ready appeal.",
        status: "COMPLETED",
        location: "New Gaurav Path, Surat",
        address: "New Gaurav Path, Surat",
        project_type: "Ready Bungalows & Plots",
        images: [sevenStreetImgUrl],
        amenities: ["Gated Community", "CCTV Surveillance", "Paver Block Roads", "Street Lights"],
        brochure: sevenStreetPdfUrl,
        faqs: [
          {
            question: "Is there bank loan facility available?",
            answer: "Yes, all major nationalized and private banks approve this project for loan."
          }
        ]
      }
    ];

    for (const p of projects) {
      const { error: prErr } = await supabaseAdmin
        .from('projects')
        .upsert(p, { onConflict: 'slug' });
      if (prErr) console.error(`Error seeding project ${p.title}:`, prErr.message);
      else console.log(`Project seeded: ${p.title}`);
    }

    // 3. Seed properties
    console.log("Seeding properties...");
    const properties = [
      {
        title: "Vaikunth Homes Premium Apartment",
        description: "Beautiful 3 BHK luxury apartment in Jahangirabad, Surat. Features premium vitrified tiles, spacious kitchen, continuous water supply, and excellent road connectivity. Part of a RERA-registered project.",
        transaction_type: "Buy",
        property_type: "Residential",
        category: "Apartment",
        location: "Jahangirabad, Surat",
        address: "Near Jahangirabad Circle, Adajan Road, Surat 395009",
        price: 4200000,
        sqt: 1250,
        bedrooms: "3 BHK",
        bathrooms: "3",
        images: [imageUrl],
        user_id: adminId
      },
      {
        title: "Parivaar Luxury Bungalow",
        description: "An ultra-luxurious 4 BHK individual bungalow on Ugat Canal Road, Surat. Features modular kitchen, private terrace garden, parking space, and modern security setup.",
        transaction_type: "Buy",
        property_type: "Residential",
        category: "Bungalows",
        location: "Ugat Canal Road, Surat",
        address: "Parivaar Enclave, Ugat Canal Road, Surat 395005",
        price: 12500000,
        sqt: 2800,
        bedrooms: "4 BHK",
        bathrooms: "4",
        images: [houseUrl],
        user_id: adminId
      },
      {
        title: "Prime Commercial Shop at Mahalaxmi Square",
        description: "A high-visibility road-facing commercial shop at the heart of Adajan, near L.P Savani Circle. Highly suitable for retail showrooms, dental clinics, or franchise outlets.",
        transaction_type: "Buy",
        property_type: "Commercial",
        category: "Shop",
        location: "Adajan, Surat",
        address: "Shop 105, Mahalaxmi Square, Near L.P Savani Circle, Adajan, Surat 395009",
        price: 8500000,
        sqt: 450,
        bedrooms: null,
        bathrooms: null,
        images: [imageUrl],
        user_id: adminId
      },
      {
        title: "Modern Commercial Office Space",
        description: "Ready to move fully furnished commercial office space in Adajan, Surat. Fully equipped with work stations, reception area, and private cabin.",
        transaction_type: "Rent",
        property_type: "Commercial",
        category: "Office",
        location: "Adajan, Surat",
        address: "Office 312, Landmark Business Hub, Adajan, Surat 395009",
        price: 25000,
        sqt: 750,
        bedrooms: null,
        bathrooms: null,
        images: [imageUrl],
        user_id: adminId
      }
    ];

    // Clear existing properties to avoid duplicates since title is not unique
    await supabaseAdmin.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: propErr } = await supabaseAdmin
      .from('properties')
      .insert(properties);
    
    if (propErr) console.error("Error seeding properties:", propErr.message);
    else console.log("Properties seeded successfully.");

    // 4. Seed reviews
    console.log("Seeding reviews...");
    const reviews = [
      {
        name: "Ashokbhai Asalaliya",
        phone: "9979451573",
        rating: 5,
        testimonial: "I had a fantastic experience working with PRAMUKH ABC. As a first-time homebuyer, I was nervous about the process, but Jaysukhbhai Kanani made everything clear and straightforward. They were incredibly responsive. Highly recommended!",
        status: "approved"
      },
      {
        name: "Kalpesh Sheliya",
        phone: "9427670408",
        rating: 5,
        testimonial: "I had an amazing experience with the team at Pramukh ABC. Their nature is incredibly cooperative, and they truly are wonderful human beings. From the moment we walked in, they treated us like family.",
        status: "approved"
      }
    ];

    // Clear existing reviews
    await supabaseAdmin.from('reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: revErr } = await supabaseAdmin
      .from('reviews')
      .insert(reviews);

    if (revErr) console.error("Error seeding reviews:", revErr.message);
    else console.log("Reviews seeded successfully.");

    // 5. Seed site content
    console.log("Seeding site content...");
    const defaultSiteContent = {
      about: {
        kicker: "About The Story Behind Us",
        title: "We shape spaces that stand for quality, trust, and long-term value.",
        intro: "Shree Jalaram Estate Agency is a dynamic real estate organization committed to delivering thoughtfully designed, high-quality developments across residential and commercial segments.",
        details: "With over 14 years of industry experience, our expertise spans private projects, commercial infrastructure, and regulation-compliant developments. Every project we undertake reflects our focus on structural integrity, smart planning, and lasting excellence.",
        stats: [
          { value: "100+", label: "Delivered Projects" },
          { value: "14+ Years", label: "of Industry Excellence" },
          { value: "25", label: "Award-winning Agents" }
        ],
        ctaLabel: "Know More About Us",
        ctaPath: "/aboutus",
        heroImage: houseUrl,
        insetImage: logoUrl
      },
      introduction: {
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoPreviewImage: parivaarImgUrl,
        title: "Welcome to Shree Jalaram",
        description: "Established in 2007, Shree Jalaram Estate Agency specializes in open plot advisory and facilitation across premium corridors in Surat. We guide retail and institutional buyers towards transparent transactions and secure, high-yield land investments.",
        points: [
          "Trusted by 5000+ clients",
          "RERA verified projects",
          "Expert real estate guidance in Surat",
          "Prime locations and smart investments"
        ],
        tags: [
          "Since 2007",
          "Transparent Dealings",
          "Client-first Approach"
        ]
      },
      home: {
        kicker: "Welcome To Shree Jalaram",
        title: "Your Premier Real Estate Partner in Surat",
        description: "We help you buy, sell, or rent properties in Jahangirabad, Ugat Canal Road, Adajan, and across all premium locations in Surat. Trust us to find your dream property.",
        primaryLabel: "Search Listings",
        primaryPath: "/search",
        secondaryLabel: "Contact Us",
        secondaryPath: "/contactus",
        image: vaikunthImgUrl
      },
      seo: {
        title: "Shree Jalaram Estate Agency - Premium Real Estate in Surat",
        description: "Find residential bungalows, plots, premium apartments and commercial shops for buy and rent across Adajan, Jahangirabad, Ugat Canal Road, Surat.",
        keywords: "real estate surat, plots in jahangirabad, bungalows in ugat road, commercial shop adajan, buy property surat",
        author: "Shree Jalaram Estate Agency"
      },
      contact: {
        email: "jalaramestate46@gmail.com",
        phone: "+91 98980 82218",
        address: "46, Shree Jalaram Estate Agency, Jahangirabad, Surat 395009",
        facebook: "https://facebook.com",
        instagram: "https://instagram.com",
        twitter: "https://twitter.com",
        youtube: "https://youtube.com"
      }
    };

    for (const [key, val] of Object.entries(defaultSiteContent)) {
      const { error: scErr } = await supabaseAdmin
        .from('site_content')
        .upsert({
          id: key,
          data: val,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (scErr) console.error(`Error seeding site content ${key}:`, scErr.message);
      else console.log(`Site content seeded: ${key}`);
    }

    console.log("\n🎉 ALL SEEDING AND IMAGE UPLOADS COMPLETED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("Critical seeding error:", err);
    process.exit(1);
  }
}

runSeed();
