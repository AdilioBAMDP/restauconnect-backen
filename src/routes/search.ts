import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { createSuccessResponse, createErrorResponse } from '../utils/helpers';

const User = require('../models/User');
const Listing = require('../models/Listing');

const router = Router();

// Get search suggestions
router.get('/suggestions', async (req, res: Response) => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q) {
      return res.json(createSuccessResponse([], 'No query provided'));
    }

    const query = q as string;
    const searchRegex = new RegExp(query, 'i');
    const suggestions: any[] = [];

    // Search users (restaurants, artisans, suppliers)
    if (type === 'all' || type === 'user') {
      const users = await User.find({
        $or: [
          { 'profile.businessName': searchRegex },
          { 'profile.description': searchRegex }
        ]
      }).limit(3).select('_id profile.businessName profile.description profile.avatar');

      users.forEach((user: any) => {
        suggestions.push({
          id: user._id.toString(),
          type: 'user',
          title: user.profile.businessName || 'Utilisateur',
          subtitle: user.profile.description || '',
          image: user.profile.avatar || null
        });
      });
    }

    // Search listings (jobs, equipment, services)
    if (type === 'all' || type === 'listing') {
      const listings = await Listing.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex }
        ]
      }).limit(3).select('_id title description type location');

      listings.forEach((listing: any) => {
        suggestions.push({
          id: listing._id.toString(),
          type: 'listing',
          title: listing.title,
          subtitle: `${listing.type} Ã¢â‚¬Â¢ ${listing.location?.city || 'Localisation non spÃƒÂ©cifiÃƒÂ©e'}`,
          image: null
        });
      });
    }

    res.json(createSuccessResponse(suggestions, 'Search suggestions retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Search suggestions error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve search suggestions', error.message));
    return;
  }
});

// Advanced search
router.post('/advanced', async (req, res: Response) => {
  try {
    const startTime = Date.now();
    const {
      query,
      filters,
      location,
      radius = 50,
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = req.body;

    const searchRegex = query ? new RegExp(query, 'i') : /.*/;
    const skip = (page - 1) * limit;

    // Build user query
    const userQuery: any = {};
    if (query) {
      userQuery.$or = [
        { 'profile.businessName': searchRegex },
        { 'profile.description': searchRegex }
      ];
    }
    if (location) {
      userQuery['profile.location.city'] = new RegExp(location, 'i');
    }

    // Build listing query
    const listingQuery: any = {};
    if (query) {
      listingQuery.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }
    if (location) {
      listingQuery['location.city'] = new RegExp(location, 'i');
    }
    if (filters?.type) {
      listingQuery.type = filters.type;
    }
    if (filters?.category) {
      listingQuery.category = filters.category;
    }

    // Execute searches
    const [users, listings] = await Promise.all([
      User.find(userQuery).limit(limit).select('_id profile email role createdAt'),
      Listing.find(listingQuery).limit(limit).select('_id title type category location salary contractType urgent featured createdAt userId')
    ]);

    const searchTime = (Date.now() - startTime) / 1000;

    const results = {
      users: users.map((user: any) => ({
        id: user._id.toString(),
        name: user.profile?.businessName || user.email,
        type: user.role,
        location: user.profile?.location || {},
        rating: 0,
        reviewCount: 0,
        image: user.profile?.avatar || null,
        verified: user.profile?.verified || false,
        distance: null
      })),
      listings: listings.map((listing: any) => ({
        id: listing._id.toString(),
        title: listing.title,
        type: listing.type,
        category: listing.category,
        location: listing.location,
        salary: listing.salary,
        contractType: listing.contractType,
        urgent: listing.urgent || false,
        featured: listing.featured || false,
        createdAt: listing.createdAt,
        company: null
      })),
      totalResults: users.length + listings.length,
      searchTime
    };

    res.json(createSuccessResponse(results, 'Advanced search completed successfully'));
    return;
  } catch (error: any) {
    logger.error('Advanced search error', error);
    res.status(500).json(createErrorResponse('Failed to perform advanced search', error.message));
    return;
  }
});

// Save search
router.post('/save', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { query, filters, name } = req.body;
    const userId = req.user!._id;

    const SavedSearch = require('../models/SavedSearch').SavedSearch;
    
    const savedSearch = new SavedSearch({
      userId,
      name: name || query,
      query,
      filters,
      alertsEnabled: true
    });

    await savedSearch.save();

    res.json(createSuccessResponse(savedSearch, 'Search saved successfully'));
    return;
  } catch (error: any) {
    logger.error('Save search error', error);
    res.status(500).json(createErrorResponse('Failed to save search', error.message));
    return;
  }
});

// Get saved searches
router.get('/saved', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const SavedSearch = require('../models/SavedSearch').SavedSearch;
    
    const savedSearches = await SavedSearch.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(createSuccessResponse(savedSearches, 'Saved searches retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Get saved searches error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve saved searches', error.message));
    return;
  }
});

export default router;
