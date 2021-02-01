const mongoose = require('mongoose');
const validator = require('validator');

const Country = require('../country/Country');

const getUser = require('./functions/getUser');
const hashPassword = require('./functions/hashPassword');
const verifyPassword = require('./functions/verifyPassword');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: {
    // Email address of the user
    type: String,
    unique: true,
    minlength: 1,
    required: true
  },
  password: {
    // Password of the user, saved hashed
    type: String,
    required: true,
    minlength: 6
  },
  agreement_approved: {
    // If user approved user agreement
    type: Boolean,
    default: false
  },
  completed: {
    // If user completed its account, cannot use the app without completing
    type: Boolean,
    default: false
  },
  country: {
    // Country of the user, required while completing account
    type: String,
    default: null
  },
  name: {
    // Name of the user, required while completing account
    type: String,
    default: null,
    maxlength: 1000
  },
  phone: {
    // Phone of the user, required while completing acount
    type: String,
    default: null,
    maxlength: 1000
  },
  gender: {
    // Gender of the user, required while completing acount. Possible values: [male, female, other, not_specified]
    type: String,
    default: null,
    maxlength: 1000
  },
  birth_year: {
    // Birth year of the user, required while completing acount
    type: Number,
    default: null
  },
  city: {
    // City of the user, required before joining a campaign/project
    type: String,
    default: null
  },
  town: {
    // Town of the user, required before joining a campaign/project
    type: String,
    default: null
  },
  information: {
    // Information field of the user, keeping question data for the user
    // Used to filter users by question from Question model
    type: Object,
    default: {}
  },
  paid_campaigns: {
    // List of ids for the campaigns/projects the user is paid for
    // Extra measure to prevent over payment
    type: Array,
    default: []
  },
  campaigns: {
    // List of ids of the campaigns the user is currently joined
    type: Array,
    default: []
  },
  payment_number: {
    // PayPal or Papara number of the user, required before user asking for a payment
    type: String,
    default: null
  },
  credit: {
    // The current credit of user, gained from campaigns or projects
    type: Number,
    default: 0
  },
  waiting_credit: {
    // The waiting credit of the user, still a document on the Payment model
    type: Number,
    default: 0
  },
  overall_credit: {
    // The overall credit of the user, updated after a waiting credit is complete
    type: Number,
    default: 0
  },
  invitor: {
    // Invitor (id of another user) of the user
    // If there is an invitor, the invitor gains 2 credits when the user receives a waiting credit
    type: String,
    default: null
  },
  password_reset_code: {
    // The secure code for resetting a password
    // Created when the user asks for a password reset
    // The code is send the user via email
    type: String,
    default: null
  },
  password_reset_last_date: {
    // The unix time that the password_reset_code will be deactivated
    // The user cannot reset his/her password using the password_reset_code after the password_reset_last_data passes
    type: Number,
    default: null
  }
});

// Before saving the user to database, hash its password
UserSchema.pre('save', hashPassword);

UserSchema.statics.findUser = function (email, password, callback) {
  // Finds the user with the given email field, then verifies it with the given password
  // Returns the user or an error if there is one

  if (!email || !password || !validator.isEmail(email))
    return callback('bad_request');

  let User = this;

  User.findOne({ email: email.trim() }).then(user => { 
    if (!user)
      return callback('document_not_found');

    verifyPassword(password.trim(), user.password, res => {
      if (!res)
        return callback('password_verification');

      if (user.gender && (user.gender == 'erkek' || user.gender == 'kadın')) {
        User.findByIdAndUpdate(mongoose.Types.ObjectId(user._id.toString()), {$set: {
          gender: user.gender == 'erkek' ? 'male' : 'female'
        }}, {new: true}, (err, user) => {
          if (err) callback('database_error');

          getUser(user, (err, user) => {
            if (err) return callback(err);
    
            return callback(null, user);
          });
        });
      } else {
        getUser(user, (err, user) => {
          if (err) return callback(err);
  
          return callback(null, user);
        });
      }
    });
  });
};

UserSchema.statics.getUserById = function (id, callback) {
  // Finds the user with the given id and returns it without deleting any field, or an error if there is one
  // Do NOT use this function while sending it to frontend, use the user object on the cookie instead

  if (!id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  const User = this;

  User.findById(mongoose.Types.ObjectId(id), (err, user) => {
    if (err) return callback(err);

    return callback(null, user);
  });
};

UserSchema.statics.createUser = function (data, callback) {
  // Create a new User document with the given data, returns the user document or an error if it exists

  if (!data || typeof data != 'object' || !data.email || !data.password || typeof data.email != 'string' || typeof data.password != 'string')
    return callback('bad_request');

  if (!validator.isEmail(data.email))
    return callback('email_validation');

  if (data.password.length < 6)
    return callback('password_length');

  const User = this;

  const newUserData = {
    email: data.email,
    password: data.password,
    invitor: data.code && validator.isMongoId(data.code.toString()) ? data.code.toString() : null,
    agreement_approved: true
  };

  const newUser = new User(newUserData);

  newUser.save((err, user) => {
    if (err && err.code == 11000) 
      return callback('email_duplication');
    if (err)
      return callback('database_error');

    getUser(user, (err, user) => {
      if (err) return callback(err);

      return callback(null, user);
    });
  });
};

UserSchema.statics.completeUser = function (id, data, callback) {
  // Update required fields of the user with given id, set completed field as true
  // Return an error if it exists

  const allowedGenderValues = ['male', 'female', 'other', 'not_specified'];

  if (!data || typeof data != 'object' || !id || !validator.isMongoId(id.toString()))
    return callback('bad_request');

  if (!data.name || typeof data.name != 'string')
    return callback('bad_request');

  data.phone = (data.phone ? data.phone.split(' ').join('') : null);

  if (!data.phone || !validator.isMobilePhone(data.phone.toString()))
    return callback('phone_validation');

  if (!data.gender || !allowedGenderValues.includes(data.gender))
    return callback('bad_request');

  if (!data.birth_year || isNaN(parseInt(data.birth_year)) || parseInt(data.birth_year) < 1920 || parseInt(data.birth_year) > 2020)
    return callback('bad_request');

  const User = this;

  Country.getCountryWithAlpha2Code(data.country, (err, country) => {
    if (err || !country)
      return callback('bad_request');

    User.findById(mongoose.Types.ObjectId(id.toString()), (err, user) => {
      if (err || !user) return callback('document_not_found');
  
      if (user.completed)
        return callback('already_authenticated');
      
      User.findByIdAndUpdate(mongoose.Types.ObjectId(id.toString()), {$set: {
        name: data.name,
        country: country.alpha2_code,
        phone: data.phone,
        gender: data.gender,
        birth_year: parseInt(data.birth_year),
        completed: true
      }}, (err, user) => {
        if (err) return callback('database_error');
        if (!user) return callback('document_not_found');
      
        return callback(null);
      });
    });
  });
};

UserSchema.statics.updateUser = function (id, data, callback) {
  // Find and update the user document with id, update only all fields are valid. Not given fields are not updated
  // Return an error if it exists

  if (!id || !validator.isMongoId(id.toString()) || !data || typeof data != 'string')
    return callback('bad_request');

  const User = this;

  User.findById(mongoose.Types.ObjectId(id.toString()), (err, user) => {
    if (err || !user) return callback('document_not_found');

    if (data.city && data.town) {
      Country.validateCityAndTown(user.country, data, res => {
        if (!res) return callback('bad_request');

        User.findByIdAndUpdate(mongoose.Types.ObjectId(id.toString()), {$set: {
          name: (data.name && typeof data.name == 'string' ? data.name : user.name),
          phone: (data.phone && validator.isMobilePhone(data.phone.toString()) ? data.phone : user.phone),
          city: data.city,
          town: data.town 
        }}, err => {
          if (err) return callback('database_error');
  
          return callback(null);
        });
      })
    } else {
      User.findByIdAndUpdate(mongoose.Types.ObjectId(id.toString()), {$set: {
        name: (data.name && typeof data.name == 'string' ? data.name : user.name),
        phone: (data.phone && validator.isMobilePhone(data.phone.toString()) ? data.phone : user.phone)   
      }}, err => {
        if (err) return callback('database_error');

        return callback(null);
      });
    }
  });
};

module.exports = mongoose.model('User', UserSchema);
