const { supabase, supabaseAdmin, isConfigured } = require('../config/supabaseClient');
const { buildFilesUrls } = require('../utils/fileHelper');

// Fallback properties in-memory mock database
let mockProperties = [
  {
    id: "property-uuid-1",
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
    images: ["/image.png"],
    user_id: "admin-uuid-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "property-uuid-2",
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
    images: ["/house.png"],
    user_id: "admin-uuid-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "property-uuid-3",
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
    images: ["/image.png"],
    user_id: "admin-uuid-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "property-uuid-4",
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
    images: ["/image.png"],
    user_id: "admin-uuid-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let mockFavorites = []; // { userId, propertyId }

// Helper to format database property row to frontend model
const formatProperty = (prop) => {
  if (!prop) return null;
  return {
    _id: prop.id,
    title: prop.title,
    description: prop.description,
    transactionType: prop.transaction_type,
    propertyType: prop.property_type,
    category: prop.category,
    location: prop.location,
    address: prop.address,
    price: prop.price,
    sqt: prop.sqt,
    bedrooms: prop.bedrooms,
    bathrooms: prop.bathrooms,
    images: Array.isArray(prop.images) ? prop.images : [],
    userId: prop.user_id,
    createdAt: prop.created_at,
    updatedAt: prop.updated_at
  };
};

// @desc    Get all properties (optionally filter by user)
// @route   POST /api/properties
// @access  Public
const getAllProperties = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!isConfigured) {
      let list = [...mockProperties];
      if (userId) {
        list = list.filter(p => p.user_id === userId);
      }
      return res.status(200).json({
        success: true,
        data: list.map(formatProperty)
      });
    }

    let query = supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: properties, error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      data: properties.map(formatProperty)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search and filter properties
// @route   GET /api/properties/search
// @access  Public
const searchProperties = async (req, res, next) => {
  try {
    const { q, propertyType, transactionType, category, bedrooms, bathrooms } = req.query;

    if (!isConfigured) {
      let results = [...mockProperties];

      if (propertyType && propertyType !== 'all') {
        results = results.filter(p => p.property_type.toLowerCase() === propertyType.toLowerCase());
      }

      if (transactionType && transactionType !== 'all') {
        results = results.filter(p => p.transaction_type.toLowerCase() === transactionType.toLowerCase());
      }

      if (category && category !== 'all') {
        results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }

      if (bedrooms && bedrooms !== '') {
        results = results.filter(p => String(p.bedrooms || '').toLowerCase().includes(String(bedrooms).toLowerCase()));
      }

      if (bathrooms && bathrooms !== '') {
        results = results.filter(p => String(p.bathrooms || '') === String(bathrooms));
      }

      let formatted = results.map(formatProperty);

      if (q && q.trim() !== '') {
        const searchStr = q.toLowerCase();
        formatted = formatted.filter(
          p =>
            p.title.toLowerCase().includes(searchStr) ||
            p.description.toLowerCase().includes(searchStr) ||
            p.location.toLowerCase().includes(searchStr) ||
            p.address.toLowerCase().includes(searchStr)
        );
      }

      return res.status(200).json({
        success: true,
        data: formatted
      });
    }

    let query = supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (propertyType && propertyType !== 'all') {
      query = query.eq('property_type', propertyType);
    }

    if (transactionType && transactionType !== 'all') {
      query = query.eq('transaction_type', transactionType);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (bedrooms && bedrooms !== '') {
      query = query.eq('bedrooms', bedrooms);
    }

    if (bathrooms && bathrooms !== '') {
      query = query.eq('bathrooms', bathrooms);
    }

    const { data: properties, error } = await query;
    if (error) throw error;

    let results = properties.map(formatProperty);

    // Manual client-side-like search query filter if search string is present
    if (q && q.trim() !== '') {
      const searchStr = q.toLowerCase();
      results = results.filter(
        p =>
          p.title.toLowerCase().includes(searchStr) ||
          p.description.toLowerCase().includes(searchStr) ||
          p.location.toLowerCase().includes(searchStr) ||
          p.address.toLowerCase().includes(searchStr)
      );
    }

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get property by ID
// @route   GET /api/properties/:id
// @access  Public
const getPropertyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const prop = mockProperties.find(p => p.id === id);
      if (!prop) {
        return res.status(404).json({
          success: false,
          message: 'Property not found.'
        });
      }
      return res.status(200).json({
        success: true,
        data: formatProperty(prop)
      });
    }

    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: formatProperty(property)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new property
// @route   POST /api/properties/create
// @access  Private
const createProperty = async (req, res, next) => {
  try {
    const {
      title,
      description,
      transactionType,
      propertyType,
      category,
      location,
      address,
      price,
      sqt,
      bedrooms,
      bathrooms
    } = req.body;

    if (!title || !description || !transactionType || !propertyType || !category || !location || !address || !price || !sqt) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    // Handles uploaded images
    let images = [];
    if (req.files && req.files.length) {
      images = buildFilesUrls(req, req.files);
    } else {
      images = ["/image.png"]; // default mock image
    }

    const userId = req.user ? req.user.id : "admin-uuid-1";

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

      return res.status(201).json({
        success: true,
        message: 'Property created successfully (in-memory).',
        data: formatProperty(newProp)
      });
    }

    const { data: newProperty, error } = await supabaseAdmin
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
        user_id: req.user ? req.user.id : null
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Property created successfully.',
      data: formatProperty(newProperty)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit/update property details
// @route   PATCH /api/properties/:id
// @access  Private
const editProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      transactionType,
      propertyType,
      category,
      location,
      address,
      price,
      sqt,
      bedrooms,
      bathrooms,
      existingImages
    } = req.body;

    if (!isConfigured) {
      const propIdx = mockProperties.findIndex(p => p.id === id);
      if (propIdx === -1) {
        return res.status(404).json({ success: false, message: 'Property not found.' });
      }

      const property = mockProperties[propIdx];

      // Handle image lists: combine existing ones (not deleted) and newly uploaded ones
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
        finalImages = Array.isArray(property.images) ? property.images : [];
      }

      if (req.files && req.files.length) {
        const newUrls = buildFilesUrls(req, req.files);
        finalImages = [...finalImages, ...newUrls];
      }

      const updated = {
        ...property,
        updated_at: new Date().toISOString()
      };

      if (title) updated.title = title;
      if (description) updated.description = description;
      if (transactionType) updated.transaction_type = transactionType;
      if (propertyType) updated.property_type = propertyType;
      if (category) updated.category = category;
      if (location) updated.location = location;
      if (address) updated.address = address;
      if (price) updated.price = Number(price);
      if (sqt) updated.sqt = Number(sqt);
      if (bedrooms !== undefined) updated.bedrooms = bedrooms || null;
      if (bathrooms !== undefined) updated.bathrooms = bathrooms || null;
      updated.images = finalImages;

      mockProperties[propIdx] = updated;

      return res.status(200).json({
        success: true,
        message: 'Property updated successfully (in-memory).',
        data: formatProperty(updated)
      });
    }

    // Fetch existing property first from database
    const { data: property, error: fetchError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    // Authorization: only property owner or admin can edit
    const isOwner = property.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: You cannot edit this listing.' });
    }

    // Handle image lists: combine existing ones (not deleted) and newly uploaded ones
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
      finalImages = Array.isArray(property.images) ? property.images : [];
    }

    if (req.files && req.files.length) {
      const newUrls = buildFilesUrls(req, req.files);
      finalImages = [...finalImages, ...newUrls];
    }

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (title) updatePayload.title = title;
    if (description) updatePayload.description = description;
    if (transactionType) updatePayload.transaction_type = transactionType;
    if (propertyType) updatePayload.property_type = propertyType;
    if (category) updatePayload.category = category;
    if (location) updatePayload.location = location;
    if (address) updatePayload.address = address;
    if (price) updatePayload.price = Number(price);
    if (sqt) updatePayload.sqt = Number(sqt);
    
    // Explicitly allow clearing bedrooms/bathrooms
    if (bedrooms !== undefined) updatePayload.bedrooms = bedrooms || null;
    if (bathrooms !== undefined) updatePayload.bathrooms = bathrooms || null;
    
    updatePayload.images = finalImages;

    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from('properties')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: 'Property updated successfully.',
      data: formatProperty(updatedProperty)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private
const deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const propIdx = mockProperties.findIndex(p => p.id === id);
      if (propIdx === -1) {
        return res.status(404).json({ success: false, message: 'Property not found.' });
      }
      mockProperties.splice(propIdx, 1);
      // Remove from favorites also
      mockFavorites = mockFavorites.filter(fav => fav.propertyId !== id);

      return res.status(200).json({
        success: true,
        message: 'Property deleted successfully (in-memory).'
      });
    }

    const { data: property, error: fetchError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const isOwner = property.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: You cannot delete this listing.' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('properties')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add to / remove from favorites
// @route   POST /api/properties/:id/favorite
// @access  Private
const toggleFavoriteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isConfigured) {
      const prop = mockProperties.find(p => p.id === id);
      if (!prop) {
        return res.status(404).json({ success: false, message: 'Property not found.' });
      }

      const favIdx = mockFavorites.findIndex(f => f.userId === userId && f.propertyId === id);
      if (favIdx !== -1) {
        mockFavorites.splice(favIdx, 1);
        return res.status(200).json({
          success: true,
          message: 'Removed from favorites (in-memory).',
          isFavorite: false
        });
      } else {
        mockFavorites.push({ userId, propertyId: id });
        return res.status(200).json({
          success: true,
          message: 'Added to favorites (in-memory).',
          isFavorite: true
        });
      }
    }

    // Check if property exists
    const { data: property, error: fetchError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    // Check if already in favorites
    const { data: favorite, error: favError } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .eq('property_id', id)
      .maybeSingle();

    if (favError) throw favError;

    if (favorite) {
      // Remove from favorites
      const { error: removeError } = await supabaseAdmin
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('property_id', id);

      if (removeError) throw removeError;

      return res.status(200).json({
        success: true,
        message: 'Removed from favorites.',
        isFavorite: false
      });
    } else {
      // Add to favorites
      const { error: addError } = await supabaseAdmin
        .from('favorites')
        .insert({
          user_id: userId,
          property_id: id
        });

      if (addError) throw addError;

      return res.status(200).json({
        success: true,
        message: 'Added to favorites.',
        isFavorite: true
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProperties,
  searchProperties,
  getPropertyById,
  createProperty,
  editProperty,
  deleteProperty,
  toggleFavoriteProperty,
  mockProperties,
  mockFavorites,
  formatProperty
};
