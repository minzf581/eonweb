const User = require('../models/User');
const bcrypt = require('bcryptjs');

class UserService {
    static async createUser(email, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email,
            password: hashedPassword
        });
        await user.save();
        return user.id;
    }

    static async verifyUser(email, password) {
        const user = await User.findOne({ email });
        if (!user) return null;
        
        const isValid = await bcrypt.compare(password, user.password);
        return isValid ? user : null;
    }

    static async findById(id) {
        return User.findById(id);
    }
}

module.exports = UserService;
