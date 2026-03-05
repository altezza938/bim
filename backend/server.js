const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Multer storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Keep original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

/**
 * Handle file upload and trigger processing
 */
app.post('/api/upload', upload.array('files'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = req.files.map(f => ({
            originalName: f.originalname,
            path: f.path,
            mimeType: f.mimetype
        }));

        console.log('Received files:', uploadedFiles);

        // Here we can trigger the Revit Add-in execution.
        // For a local daemon, we might write a job ticket to a folder that a Revit add-in polls,
        // or if using APS, we would call the APS Design Automation API.

        // For now, we will just simulate writing a job ticket.
        const jobId = Date.now().toString();
        const jobTicketPath = path.join(UPLOADS_DIR, `job_${jobId}.json`);

        const jobData = {
            jobId: jobId,
            status: 'pending',
            files: uploadedFiles,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(jobTicketPath, JSON.stringify(jobData, null, 2));

        res.json({
            message: 'Files uploaded successfully',
            jobId: jobId,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error during upload' });
    }
});

/**
 * Check job status
 */
app.get('/api/job/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const jobTicketPath = path.join(UPLOADS_DIR, `job_${jobId}.json`);

    if (fs.existsSync(jobTicketPath)) {
        const jobData = JSON.parse(fs.readFileSync(jobTicketPath, 'utf8'));
        res.json(jobData);
    } else {
        res.status(404).json({ error: 'Job not found' });
    }
});

app.listen(PORT, () => {
    console.log(`BIM Generator Backend listening on port ${PORT}`);
});
