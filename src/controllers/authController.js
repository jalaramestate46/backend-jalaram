const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, isConfigured } = require('../config/supabaseClient');
const { buildFileUrl } = require('../utils/fileHelper');

const JWT_SECRET = process.env.JWT_SECRET || 'jalaram_estate_jwt_access_secret_key_2026_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'jalaram_estate_jwt_refresh_secret_key_2026_change_me';

// Fallback users in-memory database with synchronous bcrypt hashing to prevent module reference breaking
const salt = bcrypt.genSaltSync(10);
const hashedPassword = bcrypt.hashSync('admin123', salt);
const mockUsers = [
  {
    id: 'admin-uuid-1',
    username: 'admin',
    full_name: 'Jalaram Administrator',
    email: 'admin@jalaram.com',
    password: hashedPassword,
    mobile: '9898082218',
    role: 'admin',
    avatar: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const generateTokens = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    mobile: user.mobile,
    avatar: user.avatar,
    role: user.role
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { username, fullName, email, password, mobile } = req.body;

    if (!username || !fullName || !email || !password || !mobile) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!isConfigured) {
      const existingEmail = mockUsers.find(u => u.email === email);
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'User with this email already exists.' });
      }

      const existingUsername = mockUsers.find(u => u.username === username);
      if (existingUsername) {
        return res.status(400).json({ success: false, message: 'Username is already taken.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = {
        id: `mock-user-${Date.now()}`,
        username,
        full_name: fullName,
        email,
        password: hashedPassword,
        mobile,
        role: 'user',
        avatar: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockUsers.push(newUser);

      const { accessToken, refreshToken } = generateTokens(newUser);

      return res.status(201).json({
        success: true,
        message: 'Registration successful (in-memory).',
        data: {
          user: {
            _id: newUser.id,
            username: newUser.username,
            fullName: newUser.full_name,
            email: newUser.email,
            mobile: newUser.mobile,
            avatar: newUser.avatar,
            role: newUser.role
          },
          accessToken,
          refreshToken
        }
      });
    }

    // Check if user exists in database
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingUserByEmail) {
      return res.status(400).json({ success: false, message: 'User with this email already exists.' });
    }

    const { data: existingUserByUsername } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (existingUserByUsername) {
      return res.status(400).json({ success: false, message: 'Username is already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user (default role is 'user')
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        full_name: fullName,
        email,
        password: hashedPassword,
        mobile,
        role: 'user'
      })
      .select('*')
      .single();

    if (error) throw error;

    const { accessToken, refreshToken } = generateTokens(newUser);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        user: {
          _id: newUser.id,
          username: newUser.username,
          fullName: newUser.full_name,
          email: newUser.email,
          mobile: newUser.mobile,
          avatar: newUser.avatar,
          role: newUser.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (!isConfigured) {
      const user = mockUsers.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000 // 15 mins
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful (in-memory).',
        data: {
          user: {
            _id: user.id,
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            mobile: user.mobile,
            avatar: user.avatar,
            role: user.role
          },
          accessToken,
          refreshToken
        }
      });
    }

    // Find user in database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Set HTTP-only cookie if required
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 mins
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          _id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          mobile: user.mobile,
          avatar: user.avatar,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/users/logout
// @access  Public
const logoutUser = async (req, res, next) => {
  try {
    res.clearCookie('accessToken');
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/users/refreshToken
// @access  Public
const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    if (!isConfigured) {
      const user = mockUsers.find(u => u.id === decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found.' });
      }

      const tokens = generateTokens(user);

      return res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });
    }

    // Find user in database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .maybeSingle();

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getAllUsers = async (req, res, next) => {
  try {
    if (!isConfigured) {
      const formattedUsers = mockUsers.map(user => ({
        _id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.created_at
      }));

      return res.status(200).json({
        success: true,
        data: formattedUsers
      });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, mobile, role, avatar, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedUsers = users.map(user => ({
      _id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.created_at
    }));

    res.status(200).json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile details
// @route   PUT /api/users/:idOrUsername
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const { idOrUsername } = req.params;
    const { fullName, email, mobile, username } = req.body;

    // Check permissions: can only edit own details unless admin
    const isEditingSelf = req.user.id === idOrUsername || req.user.username === idOrUsername;
    const isAdmin = req.user.role === 'admin';

    if (!isEditingSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: You cannot edit another user.' });
    }

    if (!isConfigured) {
      const userIdx = mockUsers.findIndex(
        u => u.id === idOrUsername || u.username === idOrUsername
      );

      if (userIdx === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const user = mockUsers[userIdx];
      if (fullName) user.full_name = fullName;
      if (email) user.email = email;
      if (mobile) user.mobile = mobile;
      if (username) user.username = username;
      user.updated_at = new Date().toISOString();

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully (in-memory).',
        data: {
          _id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          mobile: user.mobile,
          avatar: user.avatar,
          role: user.role
        }
      });
    }

    // Find the user first to get their ID in database
    const query = supabase.from('users').select('*');
    if (idOrUsername.includes('-') && idOrUsername.length === 36) {
      query.eq('id', idOrUsername);
    } else {
      query.eq('username', idOrUsername);
    }

    const { data: user, error: findError } = await query.maybeSingle();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Prepare update payload
    const updateData = {};
    if (fullName) updateData.full_name = fullName;
    if (email) updateData.email = email;
    if (mobile) updateData.mobile = mobile;
    if (username) updateData.username = username;

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        _id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        avatar: updatedUser.avatar,
        role: updatedUser.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user avatar or roles (roles admin only)
// @route   PATCH /api/users/:id
// @access  Private
const patchUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const updateData = {};

    // Handles avatar upload if file exists
    if (req.file) {
      updateData.avatar = buildFileUrl(req, req.file);
    }

    // Role changes are Admin-only
    if (role) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied: Only administrators can modify roles.' });
      }
      updateData.role = role;
    }

    if (!isConfigured) {
      const userIdx = mockUsers.findIndex(u => u.id === id);
      if (userIdx === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'No updates provided.' });
      }

      const user = mockUsers[userIdx];
      if (updateData.avatar) user.avatar = updateData.avatar;
      if (updateData.role) user.role = updateData.role;
      user.updated_at = new Date().toISOString();

      return res.status(200).json({
        success: true,
        message: 'User updated successfully (in-memory).',
        data: {
          _id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          mobile: user.mobile,
          avatar: user.avatar,
          role: user.role
        }
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided.' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: {
        _id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        avatar: updatedUser.avatar,
        role: updatedUser.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting oneself
    if (req.user.id === id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own administrative account.' });
    }

    if (!isConfigured) {
      const userIdx = mockUsers.findIndex(u => u.id === id);
      if (userIdx === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      mockUsers.splice(userIdx, 1);
      return res.status(200).json({
        success: true,
        message: 'User account deleted successfully (in-memory).'
      });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getAllUsers,
  updateUserProfile,
  patchUser,
  deleteUser,
  mockUsers
};
