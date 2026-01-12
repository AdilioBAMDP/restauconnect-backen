import { Router, Response } from 'express';
import { Listing } from '../models/Listing';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiResponse, SearchFilters } from '../types';

const router = Router();

// Get all listings with filters
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      type,
      status = 'active',
      urgent,
      featured,
      ecoFriendly,
      city,
      radius = 50000,
      minPrice,
      maxPrice,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = { status };

    // Apply filters
    if (category) query.category = category;
    if (type) query.type = type;
    if (urgent === 'true') query.urgent = true;
    if (featured === 'true') query.featured = true;
    if (ecoFriendly === 'true') query.ecoFriendly = true;
    if (city) query['location.city'] = { $regex: city, $options: 'i' };

    // Price filters
    if (minPrice || maxPrice) {
      query['pricing.amount'] = {};
      if (minPrice) query['pricing.amount'].$gte = Number(minPrice);
      if (maxPrice) query['pricing.amount'].$lte = Number(maxPrice);
    }

    // Text search
    if (search) {
      query.$text = { $search: search as string };
    }

    const sortOptions: any = {};
    if (search) {
      sortOptions.score = { $meta: 'textScore' };
    } else {
      sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;
    }

    const listingsQuery = Listing.find(query)
      .populate('authorId', 'name avatar role rating reviewCount verified location.city')
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .exec();
    const listings = await listingsQuery;

    const total = await Listing.countDocuments(query).exec();

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listings'
    } as ApiResponse);
    return;
  }
});

// Get listing by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const listingQuery = Listing.findById(id).populate('authorId', 'name avatar role rating reviewCount verified location profile.businessInfo')
      .exec();
    const listing = await listingQuery;

    if (!listing) {
      res.status(404).json({
        success: false,
        error: 'Listing not found'
      } as ApiResponse);
      return;
    }

    // Increment view count if user is not the author
    if (!req.user || listing.authorId.toString() !== req.user._id.toString()) {
      await (listing as any).incrementViews();
    }

    res.json({
      success: true,
      data: listing
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listing'
    } as ApiResponse);
    return;
  }
});

// Create new listing
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const listingData = {
      ...req.body,
      authorId: req.user!._id
    };

    const listing = new Listing(listingData);
    await listing.save();
    
    await listing.populate('authorId', 'name avatar role rating reviewCount verified'); // OK car sur instance

    res.status(201).json({
      success: true,
      data: listing,
      message: 'Listing created successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create listing'
    } as ApiResponse);
    return;
  }
});

// Update listing
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const listing = await Listing.findById(id).exec();
    
    if (!listing) {
      res.status(404).json({
        success: false,
        error: 'Listing not found'
      } as ApiResponse);
      return;
    }

    // Check if user can edit this listing
    if (!(listing as any).canEdit(req.user!._id) && 
        !['admin'].includes(req.user!.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    const updatedListingQuery = Listing.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('authorId', 'name avatar role rating reviewCount verified')
    .exec();
    const updatedListing = await updatedListingQuery;

    res.json({
      success: true,
      data: updatedListing,
      message: 'Listing updated successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update listing'
    } as ApiResponse);
    return;
  }
});

// Delete listing
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const listing = await Listing.findById(id).exec();
    
    if (!listing) {
      res.status(404).json({
        success: false,
        error: 'Listing not found'
      } as ApiResponse);
      return;
    }

    // Check if user can delete this listing
    if (!(listing as any).canEdit(req.user!._id) && 
        !['admin'].includes(req.user!.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      } as ApiResponse);
      return;
    }

    await Listing.findByIdAndDelete(id).exec();

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete listing'
    } as ApiResponse);
    return;
  }
});

// Get user's listings
router.get('/user/:userId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const query: any = { authorId: userId };
    if (status) query.status = status;

    const listingsQuery = Listing.find(query)
      .populate('authorId', 'name avatar role rating reviewCount verified')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .exec();
    const listings = await listingsQuery;

    const total = await Listing.countDocuments(query).exec();

    res.json({
      success: true,
      data: listings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user listings'
    } as ApiResponse);
    return;
  }
});

// Search listings nearby
router.post('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const { coordinates, radius = 50000, ...filters } = req.body;

    if (!coordinates || coordinates.length !== 2) {
      res.status(400).json({
        success: false,
        error: 'Valid coordinates required'
      } as ApiResponse);
      return;
    }

    const listings = await (Listing as any).findNearby(coordinates, radius);
    
    res.json({
      success: true,
      data: listings
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to search nearby listings'
    } as ApiResponse);
    return;
  }
});

// Get listing categories with counts
router.get('/categories/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await Listing.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$pricing.amount' },
          urgentCount: { $sum: { $cond: ['$urgent', 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]).exec();

    res.json({
      success: true,
      data: stats
    } as ApiResponse);
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category statistics'
    } as ApiResponse);
    return;
  }
});

export default router;

