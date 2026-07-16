const { supabase, supabaseAdmin, isConfigured } = require('../config/supabaseClient');

// Fallback inquiries in-memory database
let mockInquiries = [
  {
    id: "inquiry-uuid-1",
    type: "contact",
    name: "John Doe",
    mobile: "9876543210",
    email: "john@example.com",
    message: "Interested in Jahangirabad property project.",
    consent: true,
    created_at: new Date().toISOString()
  }
];

// @desc    Submit a new inquiry
// @route   POST /api/inquiries
// @access  Public
const createInquiry = async (req, res, next) => {
  try {
    const { type, name, mobile, email, message, consent, projectId, propertyId } = req.body;

    if (!type || !name || !mobile || !message) {
      return res.status(400).json({ success: false, message: 'Type, Name, Mobile and Message are required fields.' });
    }

    if (!isConfigured) {
      const newInq = {
        id: `mock-inq-${Date.now()}`,
        type,
        name,
        mobile,
        email: email || null,
        message,
        consent: consent === undefined ? true : !!consent,
        project_id: projectId || null,
        property_id: propertyId || null,
        created_at: new Date().toISOString()
      };

      // Mock joined projects / properties titles
      let projectObj = null;
      let propertyObj = null;

      if (projectId) {
        projectObj = { id: projectId, title: "Mock Project Refer", slug: "mock-proj-slug" };
      }
      if (propertyId) {
        propertyObj = { id: propertyId, title: "Mock Property Refer" };
      }

      mockInquiries.unshift(newInq);

      return res.status(201).json({
        success: true,
        message: 'Inquiry submitted successfully (in-memory).',
        data: {
          ...newInq,
          projects: projectObj,
          properties: propertyObj
        }
      });
    }

    const insertData = {
      type,
      name,
      mobile,
      email: email || null,
      message,
      consent: consent === undefined ? true : !!consent
    };

    if (projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      insertData.project_id = projectId;
    }
    if (propertyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)) {
      insertData.property_id = propertyId;
    }

    const { data: newInquiry, error } = await supabaseAdmin
      .from('inquiries')
      .insert(insertData)
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully.',
      data: newInquiry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all inquiries
// @route   GET /api/inquiries
// @access  Private/Admin
const getAllInquiries = async (req, res, next) => {
  try {
    if (!isConfigured) {
      const formattedInquiries = mockInquiries.map(inq => {
        let projectObj = null;
        let propertyObj = null;

        if (inq.project_id) {
          projectObj = { id: inq.project_id, title: "Vaikunth Homes", slug: "vaikunth-homes" };
        }
        if (inq.property_id) {
          propertyObj = { id: inq.property_id, title: "Vaikunth Homes Premium Apartment" };
        }

        return {
          _id: inq.id,
          type: inq.type,
          name: inq.name,
          mobile: inq.mobile,
          email: inq.email,
          message: inq.message,
          consent: inq.consent,
          project: projectObj,
          property: propertyObj,
          createdAt: inq.created_at
        };
      });

      return res.status(200).json({
        success: true,
        data: formattedInquiries
      });
    }

    // Fetch inquiries joined with projects and properties
    const { data: inquiries, error } = await supabase
      .from('inquiries')
      .select(`
        *,
        projects (id, title, slug),
        properties (id, title)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map database keys to friendly camelCase for frontend display
    const formattedInquiries = inquiries.map(inq => ({
      _id: inq.id,
      type: inq.type,
      name: inq.name,
      mobile: inq.mobile,
      email: inq.email,
      message: inq.message,
      consent: inq.consent,
      project: inq.projects,
      property: inq.properties,
      createdAt: inq.created_at
    }));

    res.status(200).json({
      success: true,
      data: formattedInquiries
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an inquiry
// @route   DELETE /api/inquiries/:id
// @access  Private/Admin
const deleteInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const inqIdx = mockInquiries.findIndex(i => i.id === id);
      if (inqIdx === -1) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }
      mockInquiries.splice(inqIdx, 1);
      return res.status(200).json({
        success: true,
        message: 'Inquiry deleted successfully (in-memory).'
      });
    }

    const { error } = await supabaseAdmin
      .from('inquiries')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInquiry,
  getAllInquiries,
  deleteInquiry,
  mockInquiries
};
