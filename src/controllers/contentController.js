const { supabase, supabaseAdmin, isConfigured } = require('../config/supabaseClient');

// Lazy session memory cache fallback when Supabase is not configured
let siteContentCache = null;
const getSiteContentCache = () => {
  if (!siteContentCache) {
    siteContentCache = JSON.parse(JSON.stringify(fallbacks));
  }
  return siteContentCache;
};


// Standard fallback configurations for each page content section
const fallbacks = {
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
    heroImage: "/house.png",
    heroImageAlt: "Shree Jalaram Estate workspace",
    insetImage: "/Logo.png",
    insetImageAlt: "Shree Jalaram Estate Agency"
  },
  introduction: {
    videoUrl: "https://www.youtube.com/",
    videoPreviewImage: "/house.png",
    title: "Welcome to Shree Jalaram",
    description: "Established in 2007, Shree Jalaram Estate Agency specializes in open plot advisory and facilitation for industrial, residential, and commercial developments.",
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
    kicker: "Premium Real Estate Solutions",
    title: "Your Dream Property Awaits Here",
    description: "Discover curated properties in Surat's prime locations. Expert guidance, verified listings, and transparent deals for your perfect investment.",
    primaryLabel: "Explore Properties",
    primaryPath: "/search",
    secondaryLabel: "Talk to Advisor",
    secondaryPath: "/contactus",
    image: "/image.png"
  },
  search: {
    pageTitle: "Search Properties In Surat",
    pageDescription: "Find residential and commercial properties with filters for buy, rent, BHK, location, and category.",
    heroImage: "",
    transactionTypeOptions: ["Buy", "Rent"],
    propertyTypeOptions: ["Residential", "Commercial"],
    categoryResidential: ["Apartment", "Bungalows", "Farmhouses", "Plot", "PG"],
    categoryCommercial: ["Shop", "Commercial plots", "Showrooms", "Office"],
    showPropertySubtype: false,
    showBathrooms: false,
    propertySubtypeResidential: ["Apartment", "Bungalows", "Farmhouses", "Plot"],
    propertySubtypeCommercial: ["Shop", "Commercial plots", "Showrooms", "Office"],
    bhkOptions: ["1", "2", "3", "4", "5"],
    bathroomOptions: ["1", "2", "3"]
  },
  contact: {
    email: "shreejalarmestateagency@gmail.com",
    phone: "+91 98980 82218",
    address: "117, Mahalaxmi Square, Near L.P Savani Circle, Adajan, Surat 395009",
    facebook: "",
    instagram: "",
    whatsapp: "https://wa.me/919898082218",
    youtube: ""
  },
  testimonials: [
    {
      id: 1,
      name: "Ashokbhai Asalaliya",
      phone: "9979451573",
      rating: 5,
      image: "https://ui-avatars.com/api/?name=Ashokbhai&background=4F46E5&color=fff",
      testimonial: "I had a fantastic experience working with PRAMUKH ABC. As a first-time homebuyer, I was nervous about the process, but Jaysukhbhai Kanani made everything clear and straightforward. They were incredibly responsive. Highly recommended!"
    },
    {
      id: 2,
      name: "Kalpesh Sheliya",
      phone: "9427670408",
      rating: 5,
      image: "https://ui-avatars.com/api/?name=Kalpesh&background=6366F1&color=fff",
      testimonial: "I had an amazing experience with the team at Pramukh ABC. Their nature is incredibly cooperative, and they truly are wonderful human beings. From the moment we walked in, they treated us like family."
    }
  ],
  inquiry: {
    developedByLabel: "Developed by",
    developedByDefault: "Shree Jalaram Estate Agency",
    cardTitle: "Please share your contact",
    buttonLabel: "Get Offer",
    note: "Limited time offers available"
  },
  seo: {
    home: {
      title: "Property Dealer & Real Estate Agency in Surat | Residential & Commercial Properties",
      description: "Shree Jalaram Estate Agency is the leading property dealer in Surat. Explore premium residential plots, commercial shops, apartments, bungalows & RERA-approved investment options in Adajan, Jahangirabad, and prime areas of Surat."
    },
    projects: {
      title: "New & Upcoming Real Estate Projects in Surat | Shree Jalaram",
      description: "Discover premium ongoing and completed real estate projects in Surat. Browse RERA-verified residential communities, plotted developments, bungalow designs, and commercial business hubs with site layouts and amenities."
    },
    aboutus: {
      title: "About Shree Jalaram Estate Agency | Top Property Advisors in Surat",
      description: "Since 2007, Shree Jalaram Estate Agency has been a trusted property advisor in Surat. Learn about our 14+ years of expertise in industrial, residential, and commercial land consulting."
    },
    contactus: {
      title: "Contact Shree Jalaram Estate Agency | Property Consultation Surat",
      description: "Get in touch with Shree Jalaram Estate Agency for site visits, property bookings, and expert advisory in Surat. Visit our office in Adajan or call +91-98980-82218."
    },
    search: {
      title: "Properties for Sale & Rent in Surat | Advanced Search Finder",
      description: "Use our real estate search tool to find verified residential plots, apartments, offices, and retail shops for buy or rent in Surat's most popular neighborhoods."
    },
    residential: {
      title: "Residential Properties, Apartments & Plots for Sale in Surat",
      description: "Browse top-rated residential properties in Surat including affordable flats, premium luxury bungalows, and open residential NA-approved plots in Jahangirabad, Adajan, and Ugat Canal Road."
    },
    commercial: {
      title: "Commercial Shops, Offices & Showrooms for Sale & Rent in Surat",
      description: "Explore prime commercial real estate in Surat. Buy or lease high-visibility retail shops, modern corporate offices, and business showrooms in premium complexes."
    },
    reviews: {
      title: "Client Reviews & Testimonials | Shree Jalaram Estate Agency",
      description: "Read verified customer reviews and investment testimonials from property buyers, landowners, and home purchasers who worked with Shree Jalaram Estate Agency in Surat."
    }
  }
};

// @desc    Get custom page content by section id
// @route   GET /api/content/:section
// @access  Public
const getContentSection = async (req, res, next) => {
  try {
    const { section } = req.params;
    const cache = getSiteContentCache();

    if (!isConfigured) {
      return res.status(200).json({
        success: true,
        data: cache[section] || {}
      });
    }

    const { data: record, error } = await supabase
      .from('site_content')
      .select('*')
      .eq('id', section)
      .maybeSingle();

    if (error) {
      console.warn(`Supabase query failed for section '${section}', using static fallback:`, error.message);
      return res.status(200).json({
        success: true,
        data: cache[section] || {}
      });
    }

    if (!record) {
      // If table is empty or missing this key, return standard fallback
      return res.status(200).json({
        success: true,
        data: cache[section] || {}
      });
    }

    res.status(200).json({
      success: true,
      data: record.data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update or insert page content section
// @route   PUT /api/content/:section
// @access  Private/Admin
const updateContentSection = async (req, res, next) => {
  try {
    const { section } = req.params;
    const updateData = req.body;
    const cache = getSiteContentCache();

    if (!isConfigured) {
      cache[section] = updateData;
      return res.status(200).json({
        success: true,
        message: `Section content '${section}' updated successfully (in-memory fallback).`,
        data: cache[section]
      });
    }

    const { data: record, error: fetchError } = await supabase
      .from('site_content')
      .select('*')
      .eq('id', section)
      .maybeSingle();

    let result;
    if (record) {
      // Update existing record
      const { data: updatedRecord, error: updateError } = await supabaseAdmin
        .from('site_content')
        .update({
          data: updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', section)
        .select('*')
        .single();

      if (updateError) throw updateError;
      result = updatedRecord;
    } else {
      // Create new record
      const { data: insertedRecord, error: insertError } = await supabaseAdmin
        .from('site_content')
        .insert({
          id: section,
          data: updateData
        })
        .select('*')
        .single();

      if (insertError) throw insertError;
      result = insertedRecord;
    }

    res.status(200).json({
      success: true,
      message: `Section content '${section}' updated successfully.`,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContentSection,
  updateContentSection,
  fallbacks,
  getSiteContentCache
};
