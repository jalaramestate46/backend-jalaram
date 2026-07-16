const { supabase, isConfigured } = require('../config/supabaseClient');
const { mockProperties, mockFavorites, formatProperty } = require('./propertyController');

// @desc    Get user saved/favorite properties
// @route   GET /api/favorites
// @access  Private
const getUserFavorites = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!isConfigured) {
      const userFavs = mockFavorites.filter(fav => fav.userId === userId);
      const savedProperties = userFavs
        .map(fav => mockProperties.find(p => p.id === fav.propertyId))
        .filter(p => p !== undefined && p !== null)
        .map(formatProperty);

      return res.status(200).json({
        success: true,
        data: savedProperties
      });
    }

    // Fetch favorites joined with properties
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        id,
        properties (*)
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Filter out any favorites where the property might have been deleted, and format
    const savedProperties = favorites
      .filter(fav => fav.properties !== null)
      .map(fav => formatProperty(fav.properties));

    res.status(200).json({
      success: true,
      data: savedProperties
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserFavorites
};
