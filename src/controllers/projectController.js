const { supabase, isConfigured } = require('../config/supabaseClient');
const { buildFilesUrls } = require('../utils/fileHelper');

// Fallback projects in-memory mock database
let mockProjects = [
  {
    id: "project-uuid-1",
    title: "Vaikunth Homes",
    slug: "vaikunth-homes",
    description: "A thoughtfully planned residential development designed for long-term value and comfortable family living.",
    status: "ONGOING",
    location: "Jahangirabad, Surat",
    address: "Near Jahangirabad Circle, Surat",
    project_type: "Premium Plotted Development",
    images: ["/image.png"],
    amenities: ["24/7 Security", "Clubhouse", "Children Play Area", "Jogging Track", "Water Supply"],
    faqs: [
      {
        question: "What is the RERA number for Vaikunth Homes?",
        answer: "Vaikunth Homes is fully registered and details can be checked under Gujarat RERA portal."
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "project-uuid-2",
    title: "Parivaar Bungalows",
    slug: "parivaar-bungalows",
    description: "A refined bungalow community for buyers who want better planning, stronger presentation, and a premium location.",
    status: "ONGOING",
    location: "Ugat Canal Road, Surat",
    address: "Ugat Canal Road, Surat",
    project_type: "Luxury Bungalow Community",
    images: ["/house.png"],
    amenities: ["Swimming Pool", "Gymnasium", "Landscape Garden", "Senior Citizen Park"],
    faqs: [
      {
        question: "When is the possession date?",
        answer: "Possession is expected by December 2027."
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "project-uuid-3",
    title: "7 Street Bungalows",
    slug: "7-street-bungalows",
    description: "A modern plotted and bungalow destination built to combine practical access with future-ready appeal.",
    status: "COMPLETED",
    location: "New Gaurav Path, Surat",
    address: "New Gaurav Path, Surat",
    project_type: "Ready Bungalows & Plots",
    images: ["/image.png"],
    amenities: ["Gated Community", "CCTV Surveillance", "Paver Block Roads", "Street Lights"],
    faqs: [
      {
        question: "Is there bank loan facility available?",
        answer: "Yes, all major nationalized and private banks approve this project for loan."
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Helper to format database project row to frontend model keys
const formatProject = (proj) => {
  if (!proj) return null;
  return {
    _id: proj.id,
    title: proj.title,
    slug: proj.slug,
    description: proj.description,
    status: proj.status,
    location: proj.location,
    address: proj.address,
    projectType: proj.project_type,
    images: Array.isArray(proj.images) ? proj.images : [],
    amenities: Array.isArray(proj.amenities) ? proj.amenities : [],
    faqs: Array.isArray(proj.faqs) ? proj.faqs : [],
    createdAt: proj.created_at,
    updatedAt: proj.updated_at
  };
};

// @desc    Get all projects
// @route   GET /api/projects
// @access  Public
const getAllProjects = async (req, res, next) => {
  try {
    if (!isConfigured) {
      return res.status(200).json({
        success: true,
        data: mockProjects.map(formatProject)
      });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: projects.map(formatProject)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get project by ID or Slug
// @route   GET /api/projects/:idOrSlug
// @access  Public
const getProjectByIdOrSlug = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;

    if (!isConfigured) {
      const project = mockProjects.find(
        p => p.id === idOrSlug || p.slug === idOrSlug
      );
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found.'
        });
      }
      return res.status(200).json({
        success: true,
        data: formatProject(project)
      });
    }

    const query = supabase.from('projects').select('*');

    // Checks if the search parameter is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    if (isUuid) {
      query.eq('id', idOrSlug);
    } else {
      query.eq('slug', idOrSlug);
    }

    const { data: project, error } = await query.maybeSingle();

    if (error) throw error;

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: formatProject(project)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private/Admin
const createProject = async (req, res, next) => {
  try {
    const { title, slug, description, status, location, address, projectType, amenities, faqs } = req.body;

    if (!title || !slug || !description || !status || !location || !address) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    // Parse array variables that might be stringified in form-data
    let amenitiesList = [];
    if (amenities) {
      try {
        amenitiesList = Array.isArray(amenities) ? amenities : JSON.parse(amenities);
      } catch (e) {
        amenitiesList = typeof amenities === 'string' ? [amenities] : [];
      }
    }

    let faqsList = [];
    if (faqs) {
      try {
        faqsList = Array.isArray(faqs) ? faqs : JSON.parse(faqs);
      } catch (e) {
        faqsList = [];
      }
    }

    // Handle files upload
    let images = [];
    if (req.files && req.files.length) {
      images = buildFilesUrls(req, req.files);
    } else {
      images = ["/image.png"]; // default mock image
    }

    if (!isConfigured) {
      const existingSlug = mockProjects.find(p => p.slug === slug);
      if (existingSlug) {
        return res.status(400).json({ success: false, message: 'Slug must be unique. A project with this slug already exists.' });
      }

      const newProjObj = {
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
        faqs: faqsList,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockProjects.unshift(newProjObj);

      return res.status(201).json({
        success: true,
        message: 'Project created successfully (in-memory).',
        data: formatProject(newProjObj)
      });
    }

    // Check slug uniqueness in database
    const { data: existingSlug } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug) {
      return res.status(400).json({ success: false, message: 'Slug must be unique. A project with this slug already exists.' });
    }

    const { data: newProject, error } = await supabase
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
        faqs: faqsList
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: formatProject(newProject)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit/update project details
// @route   PUT /api/projects/:id
// @access  Private/Admin
const editProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, slug, description, status, location, address, projectType, amenities, faqs, existingImages } = req.body;

    // Parse values
    let amenitiesList;
    if (amenities !== undefined) {
      try {
        amenitiesList = Array.isArray(amenities) ? amenities : JSON.parse(amenities);
      } catch (e) {
        amenitiesList = typeof amenities === 'string' ? [amenities] : [];
      }
    }

    let faqsList;
    if (faqs !== undefined) {
      try {
        faqsList = Array.isArray(faqs) ? faqs : JSON.parse(faqs);
      } catch (e) {
        faqsList = [];
      }
    }

    if (!isConfigured) {
      const projectIdx = mockProjects.findIndex(p => p.id === id);
      if (projectIdx === -1) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }

      const project = mockProjects[projectIdx];

      let finalImages = [];
      if (existingImages) {
        try {
          finalImages = Array.isArray(existingImages)
            ? existingImages
            : JSON.parse(existingImages);
        } catch (e) {
          finalImages = typeof existingImages === 'string' ? [existingImages] : [];
        }
      } else {
        finalImages = Array.isArray(project.images) ? project.images : [];
      }

      if (req.files && req.files.length) {
        const newUrls = buildFilesUrls(req, req.files);
        finalImages = [...finalImages, ...newUrls];
      }

      const updated = {
        ...project,
        updated_at: new Date().toISOString()
      };

      if (title) updated.title = title;
      if (slug) updated.slug = slug;
      if (description) updated.description = description;
      if (status) updated.status = status;
      if (location) updated.location = location;
      if (address) updated.address = address;
      if (projectType) updated.project_type = projectType;
      if (amenitiesList !== undefined) updated.amenities = amenitiesList;
      if (faqsList !== undefined) updated.faqs = faqsList;
      updated.images = finalImages;

      mockProjects[projectIdx] = updated;

      return res.status(200).json({
        success: true,
        message: 'Project updated successfully (in-memory).',
        data: formatProject(updated)
      });
    }

    // Fetch existing project from database
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    let finalImages = [];
    if (existingImages) {
      try {
        finalImages = Array.isArray(existingImages)
          ? existingImages
          : JSON.parse(existingImages);
      } catch (e) {
        finalImages = typeof existingImages === 'string' ? [existingImages] : [];
      }
    } else {
      finalImages = Array.isArray(project.images) ? project.images : [];
    }

    if (req.files && req.files.length) {
      const newUrls = buildFilesUrls(req, req.files);
      finalImages = [...finalImages, ...newUrls];
    }

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (title) updatePayload.title = title;
    if (slug) updatePayload.slug = slug;
    if (description) updatePayload.description = description;
    if (status) updatePayload.status = status;
    if (location) updatePayload.location = location;
    if (address) updatePayload.address = address;
    if (projectType) updatePayload.project_type = projectType;
    if (amenitiesList !== undefined) updatePayload.amenities = amenitiesList;
    if (faqsList !== undefined) updatePayload.faqs = faqsList;
    updatePayload.images = finalImages;

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      data: formatProject(updatedProject)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const projectIdx = mockProjects.findIndex(p => p.id === id);
      if (projectIdx === -1) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }
      mockProjects.splice(projectIdx, 1);
      return res.status(200).json({
        success: true,
        message: 'Project deleted successfully (in-memory).'
      });
    }

    // Check project exists
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProjects,
  getProjectByIdOrSlug,
  createProject,
  editProject,
  deleteProject,
  mockProjects
};
