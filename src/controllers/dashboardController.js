const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin, isConfigured } = require('../config/supabaseClient');
const { buildFileUrl, buildFilesUrls } = require('../utils/fileHelper');

// Import caches/mock tables from REST API controllers
const { mockProperties, toggleFavoriteProperty } = require('./propertyController');
const { mockProjects } = require('./projectController');
const { mockReviews } = require('./reviewController');
const { mockInquiries } = require('./inquiryController');
const { mockUsers } = require('./authController');
const { getSiteContentCache, fallbacks } = require('./contentController');

const JWT_SECRET = process.env.JWT_SECRET || 'jalaram_estate_jwt_access_secret_key_2026_change_me';

// Utility helper to sign JWT token
const signAdminToken = (user) => {
  return jwt.sign(
    {
      id: user.id || user._id,
      username: user.username,
      fullName: user.full_name || user.fullName,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
};

// @desc    Render login page
// @route   GET /admin/login
const getLogin = async (req, res, next) => {
  try {
    // If token already present, redirect to dashboard
    let token = req.cookies?.accessToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.role === 'admin') {
          return res.redirect('/admin/dashboard');
        }
      } catch (e) {
        // invalid token, proceed to render login
      }
    }
    res.render('login', { error: null });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle login authentication
// @route   POST /admin/login
const postLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', { error: 'Please enter all fields.' });
    }

    let adminUser = null;

    if (!isConfigured) {
      adminUser = mockUsers.find(u => u.email === email);
    } else {
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        adminUser = dbUser;
      } catch (err) {
        console.warn("Database query error for admin login, falling back to mock admin:", err.message);
      }

      // If user not found in database (e.g. table not seeded), fallback to mock credentials
      if (!adminUser) {
        adminUser = mockUsers.find(u => u.email === email);
      }
    }

    if (!adminUser) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    // Restrict access to administrators
    if (adminUser.role !== 'admin') {
      return res.render('login', { error: 'Access denied: You do not have administrator permissions.' });
    }

    const token = signAdminToken(adminUser);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    res.redirect('/admin/dashboard');
  } catch (error) {
    next(error);
  }
};

// @desc    Log out admin user
// @route   GET /admin/logout
const getLogout = async (req, res, next) => {
  try {
    res.clearCookie('accessToken');
    res.redirect('/admin/login');
  } catch (error) {
    next(error);
  }
};

// @desc    Render dashboard landing page
// @route   GET /admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const stats = {
      properties: 0,
      projects: 0,
      inquiries: 0,
      reviews: 0
    };
    let recentInquiries = [];

    if (!isConfigured) {
      stats.properties = mockProperties.length;
      stats.projects = mockProjects.length;
      stats.inquiries = mockInquiries.length;
      stats.reviews = mockReviews.filter(r => r.status === 'pending').length;
      
      // Formatting mock inquiries
      recentInquiries = mockInquiries.slice(0, 5).map(inq => ({
        ...inq,
        createdAt: inq.created_at
      }));
    } else {
      // Fetch stats from Supabase
      const { count: propCount } = await supabase.from('properties').select('id', { count: 'exact', head: true });
      const { count: projCount } = await supabase.from('projects').select('id', { count: 'exact', head: true });
      const { count: inqCount } = await supabase.from('inquiries').select('id', { count: 'exact', head: true });
      const { count: revCount } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      
      stats.properties = propCount || 0;
      stats.projects = projCount || 0;
      stats.inquiries = inqCount || 0;
      stats.reviews = revCount || 0;

      const { data: dbInquiries } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      recentInquiries = (dbInquiries || []).map(inq => ({
        ...inq,
        createdAt: inq.created_at
      }));
    }

    res.render('dashboard', {
      activeTab: 'dashboard',
      pageCategory: 'Dashboard',
      pageTitle: 'Overview',
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      stats,
      recentInquiries
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Render properties list & edit views
// @route   GET /admin/properties
const getProperties = async (req, res, next) => {
  try {
    const { action, id } = req.query;
    let selectedProp = null;
    let list = [];

    if (!isConfigured) {
      list = mockProperties;
      if (action === 'edit' && id) {
        selectedProp = mockProperties.find(p => p.id === id);
      }
    } else {
      const { data: dbProps } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });
      list = dbProps || [];

      if (action === 'edit' && id) {
        const { data: dbProp } = await supabase
          .from('properties')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        selectedProp = dbProp;
      }
    }

    // Format IDs to match EJS templates
    const formattedList = list.map(p => ({
      ...p,
      _id: p.id,
      propertyType: p.property_type,
      transactionType: p.transaction_type
    }));

    let formattedSelected = null;
    if (selectedProp) {
      formattedSelected = {
        ...selectedProp,
        _id: selectedProp.id,
        propertyType: selectedProp.property_type,
        transactionType: selectedProp.transaction_type
      };
    }

    res.render('properties', {
      activeTab: 'properties',
      pageCategory: 'Real Estate Listings',
      pageTitle: action === 'new' ? 'Add Property' : (action === 'edit' ? 'Modify Listing' : 'View All'),
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      action: action || 'list',
      properties: formattedList,
      property: formattedSelected
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new property listing
// @route   POST /admin/properties/create
const createProperty = async (req, res, next) => {
  try {
    const { title, description, transactionType, propertyType, category, location, address, price, sqt, bedrooms, bathrooms } = req.body;

    let images = [];
    if (req.files && req.files.length) {
      images = buildFilesUrls(req, req.files);
    } else {
      images = ["/image.png"];
    }

    const userId = req.user.id;

    if (!isConfigured) {
      const newProp = {
        id: `mock-prop-${Date.now()}`,
        title,
        description,
        transaction_type: transactionType,
        property_type: propertyType,
        category,
        location,
        address,
        price: Number(price),
        sqt: Number(sqt),
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        images,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockProperties.unshift(newProp);
    } else {
      const { error } = await supabaseAdmin
        .from('properties')
        .insert({
          title,
          description,
          transaction_type: transactionType,
          property_type: propertyType,
          category,
          location,
          address,
          price: Number(price),
          sqt: Number(sqt),
          bedrooms: bedrooms || null,
          bathrooms: bathrooms || null,
          images,
          user_id: userId
        });

      if (error) throw error;
    }

    res.redirect('/admin/properties');
  } catch (error) {
    next(error);
  }
};

// @desc    Edit property details
// @route   POST /admin/properties/:id/edit
const editProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, transactionType, propertyType, category, location, address, price, sqt, bedrooms, bathrooms, existingImages } = req.body;

    let finalImages = [];
    if (existingImages) {
      finalImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    }

    if (req.files && req.files.length) {
      const newUrls = buildFilesUrls(req, req.files);
      finalImages = [...finalImages, ...newUrls];
    }

    if (!isConfigured) {
      const propIdx = mockProperties.findIndex(p => p.id === id);
      if (propIdx !== -1) {
        mockProperties[propIdx] = {
          ...mockProperties[propIdx],
          title,
          description,
          transaction_type: transactionType,
          property_type: propertyType,
          category,
          location,
          address,
          price: Number(price),
          sqt: Number(sqt),
          bedrooms: bedrooms || null,
          bathrooms: bathrooms || null,
          images: finalImages,
          updated_at: new Date().toISOString()
        };
      }
    } else {
      const { error } = await supabaseAdmin
        .from('properties')
        .update({
          title,
          description,
          transaction_type: transactionType,
          property_type: propertyType,
          category,
          location,
          address,
          price: Number(price),
          sqt: Number(sqt),
          bedrooms: bedrooms || null,
          bathrooms: bathrooms || null,
          images: finalImages,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    }

    res.redirect('/admin/properties');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete property
// @route   GET /admin/properties/:id/delete
const deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const propIdx = mockProperties.findIndex(p => p.id === id);
      if (propIdx !== -1) {
        mockProperties.splice(propIdx, 1);
      }
    } else {
      const { error } = await supabaseAdmin
        .from('properties')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/properties');
  } catch (error) {
    next(error);
  }
};

// @desc    Render projects EJS panels
// @route   GET /admin/projects
const getProjects = async (req, res, next) => {
  try {
    const { action, id } = req.query;
    let selectedProject = null;
    let list = [];

    if (!isConfigured) {
      list = mockProjects;
      if (action === 'edit' && id) {
        selectedProject = mockProjects.find(p => p.id === id);
      }
    } else {
      const { data: dbProjs } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      list = dbProjs || [];

      if (action === 'edit' && id) {
        const { data: dbProj } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        selectedProject = dbProj;
      }
    }

    const formattedList = list.map(p => ({
      ...p,
      _id: p.id,
      projectType: p.project_type
    }));

    let formattedSelected = null;
    if (selectedProject) {
      formattedSelected = {
        ...selectedProject,
        _id: selectedProject.id,
        projectType: selectedProject.project_type
      };
    }

    res.render('projects', {
      activeTab: 'projects',
      pageCategory: 'Development Projects',
      pageTitle: action === 'new' ? 'Add Featured Project' : (action === 'edit' ? 'Modify Project' : 'View All'),
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      action: action || 'list',
      projects: formattedList,
      project: formattedSelected
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new featured project
// @route   POST /admin/projects/create
const createProject = async (req, res, next) => {
  try {
    const { title, slug, description, status, location, address, projectType, amenities } = req.body;

    let amenitiesList = [];
    if (amenities) {
      amenitiesList = amenities.split(',').map(a => a.trim()).filter(Boolean);
    }

    let images = [];
    if (req.files && req.files.images && req.files.images.length) {
      images = buildFilesUrls(req, req.files.images);
    } else {
      images = ["/image.png"];
    }

    let brochure = null;
    if (req.files && req.files.brochure && req.files.brochure[0]) {
      brochure = buildFileUrl(req, req.files.brochure[0]);
    }

    if (!isConfigured) {
      const newProj = {
        id: `mock-proj-${Date.now()}`,
        title,
        slug,
        description,
        status,
        location,
        address,
        project_type: projectType || 'Premium Development',
        images,
        amenities: amenitiesList,
        brochure,
        faqs: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockProjects.unshift(newProj);
    } else {
      const { error } = await supabaseAdmin
        .from('projects')
        .insert({
          title,
          slug,
          description,
          status,
          location,
          address,
          project_type: projectType || 'Premium Development',
          images,
          amenities: amenitiesList,
          brochure,
          faqs: []
        });

      if (error) throw error;
    }

    res.redirect('/admin/projects');
  } catch (error) {
    next(error);
  }
};

// @desc    Edit featured project details
// @route   POST /admin/projects/:id/edit
const editProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, slug, description, status, location, address, projectType, amenities, existingImages, existingBrochure } = req.body;

    let amenitiesList = [];
    if (amenities) {
      amenitiesList = amenities.split(',').map(a => a.trim()).filter(Boolean);
    }

    let finalImages = [];
    if (existingImages) {
      finalImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    }

    if (req.files && req.files.images && req.files.images.length) {
      const newUrls = buildFilesUrls(req, req.files.images);
      finalImages = [...finalImages, ...newUrls];
    }

    let brochure = existingBrochure || null;
    if (req.files && req.files.brochure && req.files.brochure[0]) {
      brochure = buildFileUrl(req, req.files.brochure[0]);
    }

    if (!isConfigured) {
      const projIdx = mockProjects.findIndex(p => p.id === id);
      if (projIdx !== -1) {
        mockProjects[projIdx] = {
          ...mockProjects[projIdx],
          title,
          slug,
          description,
          status,
          location,
          address,
          project_type: projectType,
          images: finalImages,
          amenities: amenitiesList,
          brochure,
          updated_at: new Date().toISOString()
        };
      }
    } else {
      const { error } = await supabaseAdmin
        .from('projects')
        .update({
          title,
          slug,
          description,
          status,
          location,
          address,
          project_type: projectType,
          images: finalImages,
          amenities: amenitiesList,
          brochure,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    }

    res.redirect('/admin/projects');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   GET /admin/projects/:id/delete
const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const projIdx = mockProjects.findIndex(p => p.id === id);
      if (projIdx !== -1) {
        mockProjects.splice(projIdx, 1);
      }
    } else {
      const { error } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/projects');
  } catch (error) {
    next(error);
  }
};

// @desc    Render inquiries panel
// @route   GET /admin/inquiries
const getInquiries = async (req, res, next) => {
  try {
    let list = [];

    if (!isConfigured) {
      list = mockInquiries.map(inq => {
        let projectObj = null;
        let propertyObj = null;

        if (inq.project_id) {
          projectObj = mockProjects.find(p => p.id === inq.project_id);
        }
        if (inq.property_id) {
          propertyObj = mockProperties.find(p => p.id === inq.property_id);
        }

        return {
          _id: inq.id,
          type: inq.type,
          name: inq.name,
          mobile: inq.mobile,
          email: inq.email,
          message: inq.message,
          project: projectObj,
          property: propertyObj,
          createdAt: inq.created_at
        };
      });
    } else {
      const { data: dbInqs } = await supabase
        .from('inquiries')
        .select(`
          *,
          projects (id, title, slug),
          properties (id, title)
        `)
        .order('created_at', { ascending: false });

      list = (dbInqs || []).map(inq => ({
        _id: inq.id,
        type: inq.type,
        name: inq.name,
        mobile: inq.mobile,
        email: inq.email,
        message: inq.message,
        project: inq.projects,
        property: inq.properties,
        createdAt: inq.created_at
      }));
    }

    res.render('inquiries', {
      activeTab: 'inquiries',
      pageCategory: 'Customer Leads Logs',
      pageTitle: 'Inbox',
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      inquiries: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete inquiry lead
// @route   GET /admin/inquiries/:id/delete
const deleteInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const inqIdx = mockInquiries.findIndex(i => i.id === id);
      if (inqIdx !== -1) {
        mockInquiries.splice(inqIdx, 1);
      }
    } else {
      const { error } = await supabaseAdmin
        .from('inquiries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/inquiries');
  } catch (error) {
    next(error);
  }
};

// @desc    Render reviews testimonials panel
// @route   GET /admin/reviews
const getReviews = async (req, res, next) => {
  try {
    let list = [];

    if (!isConfigured) {
      list = mockReviews.map(r => ({
        ...r,
        _id: r.id,
        createdAt: r.created_at
      }));
    } else {
      const { data: dbReviews } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      list = (dbReviews || []).map(r => ({
        ...r,
        _id: r.id,
        createdAt: r.created_at
      }));
    }

    res.render('reviews', {
      activeTab: 'reviews',
      pageCategory: 'Client Testimony',
      pageTitle: 'Moderation Portal',
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      reviews: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve review testimonial
// @route   GET /admin/reviews/:id/approve
const approveReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const revIdx = mockReviews.findIndex(r => r.id === id);
      if (revIdx !== -1) {
        mockReviews[revIdx].status = 'approved';
      }
    } else {
      const { error } = await supabaseAdmin
        .from('reviews')
        .update({ status: 'approved' })
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/reviews');
  } catch (error) {
    next(error);
  }
};

// @desc    Reject review testimonial
// @route   GET /admin/reviews/:id/reject
const rejectReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const revIdx = mockReviews.findIndex(r => r.id === id);
      if (revIdx !== -1) {
        mockReviews[revIdx].status = 'rejected';
      }
    } else {
      const { error } = await supabaseAdmin
        .from('reviews')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/reviews');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review entry
// @route   GET /admin/reviews/:id/delete
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const revIdx = mockReviews.findIndex(r => r.id === id);
      if (revIdx !== -1) {
        mockReviews.splice(revIdx, 1);
      }
    } else {
      const { error } = await supabaseAdmin
        .from('reviews')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/reviews');
  } catch (error) {
    next(error);
  }
};

// @desc    Render user accounts permissions list
// @route   GET /admin/users
const getUsers = async (req, res, next) => {
  try {
    let list = [];

    if (!isConfigured) {
      list = mockUsers.map(u => ({
        _id: u.id,
        fullName: u.full_name,
        username: u.username,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        avatar: u.avatar,
        createdAt: u.created_at
      }));
    } else {
      const { data: dbUsers } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      list = (dbUsers || []).map(u => ({
        _id: u.id,
        fullName: u.full_name,
        username: u.username,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        avatar: u.avatar,
        createdAt: u.created_at
      }));
    }

    res.render('users', {
      activeTab: 'users',
      pageCategory: 'User Access Control',
      pageTitle: 'Permissions Manager',
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      users: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user role (User <-> Admin)
// @route   GET /admin/users/:id/toggle-role
const toggleUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent changing self
    if (req.user.id === id) {
      return res.redirect('/admin/users');
    }

    if (!isConfigured) {
      const userIdx = mockUsers.findIndex(u => u.id === id);
      if (userIdx !== -1) {
        mockUsers[userIdx].role = mockUsers[userIdx].role === 'admin' ? 'user' : 'admin';
      }
    } else {
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', id)
        .single();
      
      if (user) {
        const nextRole = user.role === 'admin' ? 'user' : 'admin';
        const { error } = await supabaseAdmin
          .from('users')
          .update({ role: nextRole })
          .eq('id', id);
        if (error) throw error;
      }
    }

    res.redirect('/admin/users');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   GET /admin/users/:id/delete
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (req.user.id === id) {
      return res.redirect('/admin/users');
    }

    if (!isConfigured) {
      const userIdx = mockUsers.findIndex(u => u.id === id);
      if (userIdx !== -1) {
        mockUsers.splice(userIdx, 1);
      }
    } else {
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }

    res.redirect('/admin/users');
  } catch (error) {
    next(error);
  }
};

// @desc    Render copywriting and SEO config forms
// @route   GET /admin/content
const getContent = async (req, res, next) => {
  try {
    const sections = ['home', 'about', 'contact', 'seo', 'introduction'];
    const content = {};

    if (!isConfigured) {
      const cache = getSiteContentCache();
      sections.forEach(s => {
        content[s] = cache[s] || fallbacks[s] || {};
      });
    } else {
      for (const s of sections) {
        const { data: dbSec } = await supabaseAdmin
          .from('site_content')
          .select('data')
          .eq('id', s)
          .maybeSingle();
        content[s] = dbSec ? dbSec.data : (fallbacks[s] || {});
      }
    }

    res.render('content', {
      activeTab: 'content',
      pageCategory: 'Website Copywriting & Metadata',
      pageTitle: 'Site Content Customizer',
      adminUser: req.user,
      supabaseConfigured: isConfigured,
      content
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Handle copywriting updates
// @route   POST /admin/content/:section
const postContent = async (req, res, next) => {
  try {
    const { section } = req.params;
    let dataToSave = req.body;

    // Parse structures
    if (section === 'seo') {
      dataToSave = req.body.seo;
    } else if (section === 'home') {
      let finalImg = req.body.existingImage || "/image.png";
      if (req.files && req.files.image && req.files.image[0]) {
        finalImg = buildFileUrl(req, req.files.image[0]);
      }
      dataToSave = {
        kicker: req.body.kicker,
        title: req.body.title,
        description: req.body.description,
        primaryLabel: req.body.primaryLabel,
        primaryPath: req.body.primaryPath || "/search",
        secondaryLabel: req.body.secondaryLabel,
        secondaryPath: req.body.secondaryPath || "/contactus",
        image: finalImg
      };
    } else if (section === 'introduction') {
      const { videoUrl, title, description, points, tags } = req.body;
      let finalPreviewImage = req.body.existingVideoPreviewImage || "/house.png";
      if (req.files && req.files.videoPreviewImage && req.files.videoPreviewImage[0]) {
        finalPreviewImage = buildFileUrl(req, req.files.videoPreviewImage[0]);
      }
      dataToSave = {
        videoUrl,
        videoPreviewImage: finalPreviewImage,
        title,
        description,
        points: typeof points === 'string' ? points.split(',').map(p => p.trim()).filter(Boolean) : [],
        tags: typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };
    } else if (section === 'about') {
      const { kicker, title, intro, details, ctaLabel, ctaPath, stats_0_val, stats_0_lbl, stats_1_val, stats_1_lbl, stats_2_val, stats_2_lbl } = req.body;
      let finalHeroImage = req.body.existingHeroImage || "/house.png";
      if (req.files && req.files.heroImage && req.files.heroImage[0]) {
        finalHeroImage = buildFileUrl(req, req.files.heroImage[0]);
      }
      let finalInsetImage = req.body.existingInsetImage || "/Logo.png";
      if (req.files && req.files.insetImage && req.files.insetImage[0]) {
        finalInsetImage = buildFileUrl(req, req.files.insetImage[0]);
      }
      dataToSave = {
        kicker,
        title,
        intro,
        details,
        ctaLabel: ctaLabel || "Know More About Us",
        ctaPath: ctaPath || "/aboutus",
        heroImage: finalHeroImage,
        insetImage: finalInsetImage,
        stats: [
          { value: stats_0_val || '100+', label: stats_0_lbl || 'Delivered Projects' },
          { value: stats_1_val || '14+ Years', label: stats_1_lbl || 'of Industry Excellence' },
          { value: stats_2_val || '25', label: stats_2_lbl || 'Award-winning Agents' }
        ]
      };
    }

    if (!isConfigured) {
      const cache = getSiteContentCache();
      cache[section] = dataToSave;
    } else {
      const { data: record } = await supabaseAdmin
        .from('site_content')
        .select('*')
        .eq('id', section)
        .maybeSingle();

      if (record) {
        const { error } = await supabaseAdmin
          .from('site_content')
          .update({ data: dataToSave, updated_at: new Date().toISOString() })
          .eq('id', section);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from('site_content')
          .insert({ id: section, data: dataToSave });
        if (error) throw error;
      }
    }

    res.redirect('/admin/content');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLogin,
  postLogin,
  getLogout,
  getDashboard,
  getProperties,
  createProperty,
  editProperty,
  deleteProperty,
  getProjects,
  createProject,
  editProject,
  deleteProject,
  getInquiries,
  deleteInquiry,
  getReviews,
  approveReview,
  rejectReview,
  deleteReview,
  getUsers,
  toggleUserRole,
  deleteUser,
  getContent,
  postContent
};
