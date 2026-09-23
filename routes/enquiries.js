/* ============================================================
   Oceania Adventure Guild - enquiry route
   SIT774 Website Project, Part 3 (Task 10.2D)

   One route:

     POST /api/enquiries   store an enquiry from the contact form

   Used from server.js as:  require('./routes/enquiries')(app, db);

   Anyone may send an enquiry, logged in or not: a visitor with a
   question about joining is exactly who the form is for. If the
   sender is logged in the enquiry is tied to their account,
   otherwise it is stored with no account at all.

   The one exception is an administrator. Administrators receive
   enquiries in their inbox rather than send them, and the guild
   account never appears in the database as a party to its own
   correspondence.

   The browser checks the form first, and this repeats every
   check, because a request can be sent without using the form.
   ============================================================ */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[0-9]{8,15}$/;
const ENQUIRY_TYPES = ['general', 'posting', 'hiring', 'shop', 'membership'];

const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;


module.exports = function mountEnquiryRoutes(app, db) {

  const insertEnquiry = db.prepare(`
    INSERT INTO enquiries (user_id, name, email, phone, enquiry_type, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  /**
   * Checks an enquiry body and returns the cleaned values along with
   * any problems, keyed by field name so the page can show each
   * message beside its field. Every value is type checked first,
   * because Express 5 leaves req.body undefined when no JSON arrives
   * and a JSON body can hold an object where a string is expected.
   */
  function validate(body) {
    const input = body ?? {};
    const errors = {};

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    const phone = typeof input.phone === 'string' ? input.phone.replace(/\s/g, '') : '';
    const type = typeof input.enquiryType === 'string' ? input.enquiryType : '';
    const message = typeof input.message === 'string' ? input.message.trim() : '';

    if (name === '') {
      errors.name = 'Enter your name.';
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.name = 'Keep your name to ' + MAX_NAME_LENGTH + ' characters or fewer.';
    }

    if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
      errors.email = 'Enter an email address in the form name@example.com.';
    }

    if (!PHONE_PATTERN.test(phone)) {
      errors.phone = 'Enter between 8 and 15 digits.';
    }

    if (!ENQUIRY_TYPES.includes(type)) {
      errors.enquiryType = 'Choose what your enquiry is about.';
    }

    if (message.length < MIN_MESSAGE_LENGTH) {
      errors.message = 'Tell us a little more, at least ' + MIN_MESSAGE_LENGTH + ' characters.';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      errors.message = 'Keep the message to ' + MAX_MESSAGE_LENGTH + ' characters or fewer.';
    }

    return { errors, values: { name, email, phone, type, message } };
  }

  app.post('/api/enquiries', (req, res, next) => {
    const user = req.session.user;

    if (user && user.role === 'admin') {
      return res.status(403).json({
        error: 'Administrators receive enquiries rather than send them.'
      });
    }

    const { errors, values } = validate(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: errors });
    }

    let result;

    try {
      result = insertEnquiry.run(
        user ? user.id : null,
        values.name,
        values.email,
        values.phone,
        values.type,
        values.message
      );
    } catch (err) {
      // The error handler logs the real cause and shows the visitor
      // only a general message.
      return next(err);
    }

    // The id doubles as a reference the sender can quote.
    res.status(201).json({
      message: 'Your enquiry has been received.',
      enquiry: { id: Number(result.lastInsertRowid) }
    });
  });

};
