const Product = require("../models/product");
const formidable = require("formidable");
const imgbbUploader = require("imgbb-uploader");
const productValidationSchema = require("../validation/productCreationValidation");
const ticketValidationSchema = require("../validation/productCreationValidation");
const Category = require("../models/category");
const Ticket = require("../models/ticket");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const createProduct = async (req, res, next) => {
  try {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) return next(err);

      const images = [];
      const uploadPromises = [];

      // Upload files to ImgBB
      for (const fileKey in files) {
        if (files.hasOwnProperty(fileKey)) {
          const uploadPromise = imgbbUploader(
            "233bc527d5a1c48bda36603a1d0eaf01",
            files[fileKey][0].filepath
          );
          images.push({ name: fileKey, promise: uploadPromise });
          uploadPromises.push(uploadPromise);
        }
      }

      // getting all productData in an object
      const productData = JSON.parse(fields["productData"]);

      // Check for duplicate product
      const matchedProduct = await Product.findOne({
        modelNumber: productData.modelNumber,
      });
      if (matchedProduct) return next(new Error("Duplicate Product"));

      // Validate product data using JOI
      const { error } = productValidationSchema.validate(productData);
      if (error) return next(new Error(error));

      // Wait for all image uploads to complete
      const responses = await Promise.all(uploadPromises);

      // // Store image URLs in product data
      const imagesUrls = responses.map((response, index) => ({
        name: images[index].name,
        url: response.display_url,
      }));
      productData.images = imagesUrls;

      // Find category ID
      const productCategory = await Category.findOne({
        name: productData.category,
        subCategories: productData.subCategory,
      });

      console.log(productData.category, productData.subCategory);

      // If category not found or does't have the same subcategory throw error
      if (!productCategory) {
        throw new Error("Invalid Category");
      }

      // Add category ID to product data
      productData.category = productCategory._id;

      // Create product document
      const createdProduct = await Product.create(productData);

      // Send response with product data
      res.status(200).json({ success: true, productData: createdProduct });
    });
  } catch (error) {
    next(error);
  }
};

const getAllProducts = async (req, res, next) => {
  try {
    // Get search keys from request params
    const {
      id_modelNumber,
      name,
      brandName,
      category,
      subCategory,
      val1,
      val2,
      sortBy,
      order,
    } = req.query;
    let searchQuery = {};
    // Assigning search key
    if (id_modelNumber) {
      if (id_modelNumber.match(/^[0-9a-fA-F]{24}$/)) {
        // If the query is a valid MongoDB ID
        searchQuery._id = id_modelNumber;
      } else {
        // if the query is a string not matching the patterns match it with last name or first name
        searchQuery.modelNumber = { $regex: id_modelNumber, $options: "i" };
      }
    }

    // Checking for different search parameters and adding them to the dynamic query
    if (name) {
      searchQuery.name = { $regex: name, $options: "i" };
    }

    if (brandName) {
      searchQuery.brandName = { $regex: brandName, $options: "i" };
    }

    if (category && category.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(category);
      const categoryObjectId = new ObjectId(category);
      searchQuery.category = categoryObjectId;
    }

    if (subCategory) {
      searchQuery.subCategory = subCategory;
    }

    console.log(val1, val2);
    if (val1 && val2) {
      searchQuery.price = {
        $gt: Math.min(val1, val2),
        $lt: Math.max(val1, val2),
      };
    }

    // Set Sort Query
    const sortQuery = {};
    if (sortBy && (order ? order : "desc")) {
      sortQuery[sortBy] = order === "desc" ? -1 : 1; // order can be 'asc' or 'desc'
    } else {
      // If sortBy or order is not provided some default criteria is provided
      sortQuery["createdAt"] = -1; // sorting by firstName field in descending order
    }

    //Get page number from request params
    const pageNumber = parseInt(req.query.p, 10) || 1;
    const numberPerPage = parseInt(req.query.limit) || 10;
    const skipItems = (pageNumber - 1) * numberPerPage;

    // Retrieve total count of products (unpaginated)
    const totalCount = await Product.countDocuments(searchQuery);

    // Retrieve all products from the database paginated
    const products = await Product.aggregate([
      {
        // Match documents to the search query
        $match: searchQuery,
      },
      {
        // Sort my query based on the sorting provided
        $sort: sortQuery,
      },
      {
        // Modify the results for pagination
        $skip: skipItems,
      },
      {
        $limit: numberPerPage,
      },
    ]);
    // Check if any products were found
    // if (!products || products.length === 0) {
    //   res.status(200).json({ success: true, products: [] });
    // }

    // Return the products
    res.status(200).json({
      success: true,
      products: products,
      numberOfProducts: totalCount,
    });
  } catch (error) {
    // Pass any errors to the error handling middleware
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const form = new formidable.IncomingForm();
    const productId = req.params.productId;

    form.parse(req, async (err, fields, files) => {
      if (err) return next(err);

      const images = [];
      const uploadPromises = [];

      // Upload files to ImgBB
      for (const fileKey in files) {
        if (files.hasOwnProperty(fileKey)) {
          const uploadPromise = imgbbUploader(
            "233bc527d5a1c48bda36603a1d0eaf01",
            files[fileKey][0].filepath
          );
          images.push({ name: fileKey, promise: uploadPromise });
          uploadPromises.push(uploadPromise);
        }
      }

      // getting all productData in an object
      const productData = JSON.parse(fields["productData"]);

      // Check for duplicate product
      const matchedProduct = await Product.findById(productId);
      if (!matchedProduct) return next(new Error("Product not found"));

      // Validate product data using JOI
      const { error } = productValidationSchema.validate(productData);
      if (error) return next(new Error(error));

      // Wait for all image uploads to complete
      const responses = await Promise.all(uploadPromises);

      // Store image URLs in product data
      const imagesUrls = responses.map((response, index) => ({
        name: images[index].name,
        url: response.display_url,
      }));
      productData.images = imagesUrls;

      // Find category ID
      const productCategory = await Category.findOne({
        name: productData.category,
        subCategories: productData.subCategory,
      });

      console.log(
        productData.category,
        productData.subCategory,
        productCategory
      );

      // If category not found or does't have the same subcategory throw error
      if (!productCategory) {
        throw new Error("Invalid Category");
      }

      // // Add category ID to product data
      productData.category = productCategory._id;

      // Create product document
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        productData,
        {
          new: true,
        }
      );

      // // Send response with product data
      res.status(200).json({ success: true, product: updatedProduct });
    });
  } catch (error) {
    next(error);
  }
};

const getProduct = async (req, res, next) => {
  try {
    // Fetch product from the database
    const product = await Product.findById({ _id: req.params.productId });

    // Return the list of users in the response
    res.status(200).json(product);
  } catch (error) {
    // If an error occurs, pass it to the error handling middleware
    next(error);
  }
};

const freezeProducts = async (req, res, next) => {
  try {
    // Get Id array from req body
    const productIds = req.body.productIds;

    // update all posts in Id array
    const updatedProducts = await Product.updateMany(
      { _id: { $in: productIds } },
      { frozen: true }
    );

    // Return the list of updated users in the response
    res.status(200).json(updatedProducts);
  } catch (error) {
    // If an error occurs, pass it to the error handling middleware
    next(error);
  }
};

const unFreezeProducts = async (req, res, next) => {
  try {
    // Get Id array from req body
    const productIds = req.body.productIds;

    // update all posts in Id array
    const updatedProducts = await Product.updateMany(
      { _id: { $in: productIds } },
      { frozen: false }
    );

    // Return the list of updated users in the response
    res.status(200).json(updatedProducts);
  } catch (error) {
    // If an error occurs, pass it to the error handling middleware
    next(error);
  }
};

const deleteProducts = async (req, res, next) => {
  try {
    const idArray = req.body.productIds;
    console.log(idArray);
    if (!Array.isArray(idArray) || idArray.length === 0) {
      throw new Error("Product IDs array is required");
    }

    // Preforming deletion
    const deletedProducts = await Product.deleteMany({ _id: { $in: idArray } });

    // Check if any products were deleted
    if (deletedProducts.deletedCount === 0) {
      throw new Error("No products found to delete");
    }

    // Return a success message or the number of products deleted
    res.status(200).json({
      message: `${deletedProducts.deletedCount} products deleted successfully`,
    });
    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
};

const addTicket = async (req, res, next) => {
  try {
    // Validate ticket input
    const { error } = ticketValidationSchema.validate(req.body);
    if (error) {
      throw new Error(error);
    }

    // Extracting data from the request body
    const { title, description, product_ids } = req.body;

    // Creating a new ticket document
    const newTicket = await Ticket.create({
      title,
      description,
      product_ids,
    });

    // Update products with the new ticket id
    await Product.updateMany(
      { _id: { $in: product_ids } }, // Update products with matching IDs
      { $push: { tickets: newTicket._id } } // Add the new ticket ID to the tickets array
    );

    // Sending a success response with the newly created ticket
    res.status(201).json({ Ticket: newTicket });
  } catch (error) {
    // Handling errors
    next(error);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  updateProduct,
  getProduct,
  freezeProducts,
  addTicket,
  unFreezeProducts,
  deleteProducts,
};
