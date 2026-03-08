# Student Academic Database

A full-stack web application for managing student academic records, work experience, and English proficiency scores.

## Features

- **Student Management**: Add, view, update, and delete student records
- **Academic Records**: Track university, major, GPA, courses, and honors
- **Work Experience**: Record professional experience with company details
- **English Scores**: Monitor language proficiency test results
- **Document Upload**: Upload and manage student documents (resume, certificates, etc.)
- **Data Visualization**: Interactive charts and statistics
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js
- **File Upload**: Multer

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MySQL Server
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd student-database
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   - Create a MySQL database
   - Import the schema: `mysql -u root -p < database.sql`
   - Update `.env` file with your database credentials

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=student_db
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Open in browser**
   Navigate to `http://localhost:3000`

## API Endpoints

- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/academics` - Get academic records
- `GET /api/english` - Get English scores
- `GET /api/work-experience` - Get work experience
- `POST /api/documents` - Upload document
- `DELETE /api/documents/:id` - Delete document

## File Structure

```
├── database.sql          # Database schema and sample data
├── db.js                 # Database connection configuration
├── server.js             # Express server
├── index.html            # Main HTML file
├── styles.css            # CSS styles
├── script.js             # Frontend JavaScript
├── package.json          # Node.js dependencies
├── .env                  # Environment variables (create this)
└── documents/            # Uploaded documents directory
```

## Development

For development with auto-reload:
```bash
npm run dev
```

## Security Notes

- Update database credentials in `.env` file
- Ensure MySQL server is properly secured
- Validate file uploads on production
- Use HTTPS in production

## License

ISC