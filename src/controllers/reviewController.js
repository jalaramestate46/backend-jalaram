const { supabase, supabaseAdmin, isConfigured } = require('../config/supabaseClient');

// Fallback reviews in-memory database
let mockReviews = [
  {
    id: "review-uuid-1",
    name: "Ashokbhai Asalaliya",
    phone: "9979451573",
    rating: 5,
    testimonial: "I had a fantastic experience working with PRAMUKH ABC. As a first-time homebuyer, I was nervous about the process, but Jaysukhbhai Kanani made everything clear and straightforward. They were incredibly responsive. Highly recommended!",
    status: "approved",
    created_at: new Date().toISOString()
  },
  {
    id: "review-uuid-2",
    name: "Kalpesh Sheliya",
    phone: "9427670408",
    rating: 5,
    testimonial: "I had an amazing experience with the team at Pramukh ABC. Their nature is incredibly cooperative, and they truly are wonderful human beings. From the moment we walked in, they treated us like family.",
    status: "approved",
    created_at: new Date().toISOString()
  }
];

// Helper to format review keys
const formatReview = (rev) => {
  if (!rev) return null;
  return {
    _id: rev.id,
    name: rev.name,
    phone: rev.phone,
    rating: rev.rating,
    testimonial: rev.testimonial,
    status: rev.status,
    createdAt: rev.created_at
  };
};

// @desc    Get reviews
// @route   GET /api/reviews
// @access  Public
const getReviews = async (req, res, next) => {
  try {
    const isAdminQuery = req.query.admin === 'true';

    if (!isConfigured) {
      let list = [...mockReviews];
      if (!isAdminQuery) {
        list = list.filter(r => r.status === 'approved');
      }
      return res.status(200).json({
        success: true,
        data: list.map(formatReview)
      });
    }

    let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });

    // Public only sees approved reviews. Admins see all.
    if (!isAdminQuery) {
      query = query.eq('status', 'approved');
    }

    const { data: reviews, error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      data: reviews.map(formatReview)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a review
// @route   POST /api/reviews
// @access  Public
const addReview = async (req, res, next) => {
  try {
    const { name, phone, rating, testimonial } = req.body;

    if (!name || !phone || !rating || !testimonial) {
      return res.status(400).json({ success: false, message: 'Name, phone, rating, and testimonial are required.' });
    }

    if (!isConfigured) {
      const newRev = {
        id: `mock-rev-${Date.now()}`,
        name,
        phone,
        rating: Number(rating),
        testimonial,
        status: 'pending', // requires admin approval
        created_at: new Date().toISOString()
      };

      mockReviews.unshift(newRev);

      return res.status(201).json({
        success: true,
        message: 'Review submitted. It will appear on the website once approved by an administrator (in-memory).',
        data: formatReview(newRev)
      });
    }

    const { data: newReview, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        name,
        phone,
        rating: Number(rating),
        testimonial,
        status: 'pending' // requires admin approval
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Review submitted. It will appear on the website once approved by an administrator.',
      data: formatReview(newReview)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update review status (Approve or Reject)
// @route   PATCH /api/reviews/:id
// @access  Private/Admin
const updateReviewStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    if (!isConfigured) {
      const revIdx = mockReviews.findIndex(r => r.id === id);
      if (revIdx === -1) {
        return res.status(404).json({ success: false, message: 'Review not found.' });
      }

      mockReviews[revIdx].status = status;

      return res.status(200).json({
        success: true,
        message: `Review status updated to ${status} (in-memory).`,
        data: formatReview(mockReviews[revIdx])
      });
    }

    const { data: updatedReview, error } = await supabaseAdmin
      .from('reviews')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `Review status updated to ${status}.`,
      data: formatReview(updatedReview)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isConfigured) {
      const revIdx = mockReviews.findIndex(r => r.id === id);
      if (revIdx === -1) {
        return res.status(404).json({ success: false, message: 'Review not found.' });
      }
      mockReviews.splice(revIdx, 1);
      return res.status(200).json({
        success: true,
        message: 'Review deleted successfully (in-memory).'
      });
    }

    const { error } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReviews,
  addReview,
  updateReviewStatus,
  deleteReview,
  mockReviews
};
