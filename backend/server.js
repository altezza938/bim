const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

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

/**
 * Upload FGDB and List Features
 */
app.post('/api/upload-fgdb', upload.single('fgdb'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No FGDB zip uploaded' });
        }

        const zipPath = req.file.path;
        console.log(`Processing FGDB: ${zipPath}`);

        // Call the Python script to list features
        const pythonProcess = spawn('python3', [
            path.join(__dirname, 'extract_fgdb.py'),
            zipPath,
            'list'
        ]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}. Error: ${errorString}`);
                return res.status(500).json({ error: 'Failed to parse FGDB', details: errorString });
            }

            try {
                const result = JSON.parse(dataString);
                if (result.error) {
                    return res.status(500).json({ error: result.error });
                }

                res.json({
                    message: 'FGDB parsed successfully',
                    filePath: zipPath,
                    features: result.features
                });
            } catch (e) {
                console.error('JSON parse error from Python:', e, dataString);
                res.status(500).json({ error: 'Invalid response from FGDB parser' });
            }
        });

    } catch (error) {
        console.error('Upload FGDB error:', error);
        res.status(500).json({ error: 'Internal server error during FGDB upload' });
    }
});

/**
 * Extract Specific Feature from FGDB
 */
app.post('/api/extract-feature', (req, res) => {
    const { filePath, featureNo } = req.body;

    if (!filePath || !featureNo) {
        return res.status(400).json({ error: 'File path and Feature Number are required' });
    }

    console.log(`Extracting Feature ${featureNo} from ${filePath}`);

    const pythonProcess = spawn('python3', [
        path.join(__dirname, 'extract_fgdb.py'),
        filePath,
        'extract',
        featureNo
    ]);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python script exited with code ${code}. Error: ${errorString}`);
            return res.status(500).json({ error: 'Failed to extract feature', details: errorString });
        }

        try {
            const result = JSON.parse(dataString);
            if (result.error) {
                return res.status(500).json({ error: result.error });
            }

            res.json(result); // Return the GeoJSON
        } catch (e) {
            console.error('JSON parse error from Python:', e, dataString);
            res.status(500).json({ error: 'Invalid response from GeoJSON extractor' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`BIM Generator Backend listening on port ${PORT}`);
});
