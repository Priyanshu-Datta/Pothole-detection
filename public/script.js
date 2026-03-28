// ================= BASE URL =================
const BASE_URL = "http://localhost:5000";

// ================= DOM ELEMENTS =================
const uploadBox = document.getElementById('uploadBox');
const imageInput = document.getElementById('imageInput');
const resultsSection = document.getElementById('resultsSection');
const historySection = document.getElementById('historySection');
const loadingSpinner = document.getElementById('loadingSpinner');
const predictionModal = document.getElementById('predictionModal');
const modalClose = document.querySelector('.close');

// ================= CLASS INFO =================
const CLASS_INFO = {
    good: { label: 'Good', emoji: '✅', color: '#28a745' },
    satisfactory: { label: 'Satisfactory', emoji: '⚠️', color: '#ffc107' },
    poor: { label: 'Poor', emoji: '⚠️', color: '#fd7e14' },
    very_poor: { label: 'Very Poor', emoji: '🚨', color: '#dc3545' }
};

function getSafeClassInfo(cls) {
    return CLASS_INFO[cls] || {
        label: cls || 'Unknown',
        emoji: 'ℹ️',
        color: '#6c757d'
    };
}

// ================= EVENT LISTENERS =================
uploadBox.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (file) uploadImage(file);
});

modalClose.onclick = () => predictionModal.style.display = "none";

// ================= UPLOAD IMAGE =================
async function uploadImage(file) {
    loadingSpinner.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${BASE_URL}/api/predict`, {
            method: "POST",
            body: formData
        });

        const result = await res.json();

        if (!result.success) throw new Error(result.error);

        console.log("✅ Prediction:", result);

        displayResults(result.data);

        resultsSection.style.display = 'block';

        // Reload history after prediction
        loadPredictionHistory();

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// ================= DISPLAY RESULT =================
function displayResults(data) {
    const { prediction, confidence, filename } = data;

    const info = getSafeClassInfo(prediction);

    // Show uploaded image
    document.getElementById('previewImage').src =
        `${BASE_URL}/uploads/${filename}`;

    // Show prediction
    document.getElementById('predictionResult').innerHTML = `
        <h2>${info.emoji} ${info.label}</h2>
        <p>Confidence: ${(confidence ?? 0).toFixed(2)}%</p>
    `;
}

// ================= LOAD HISTORY =================
async function loadPredictionHistory() {
    try {
        const res = await fetch(`${BASE_URL}/api/predictions`);
        const result = await res.json();

        if (!result.success) return;

        const container = document.getElementById('historyContainer');

        if (!result.data.length) {
            container.innerHTML = "<p>No predictions yet</p>";
            return;
        }

        container.innerHTML = result.data.map(pred => {
            const info = getSafeClassInfo(pred.predictedClass);
            const date = new Date(pred.createdAt).toLocaleString();
            const confidence = (pred.confidence ?? 0);

            return `
                <div class="history-item" onclick="viewPrediction('${pred._id}')">
                    <strong>${info.emoji} ${info.label}</strong>
                    <br>Confidence: ${confidence.toFixed(2)}%
                    <br><small>${date}</small>
                    <br>
                    <button onclick="deletePrediction('${pred._id}', event)">
                        Delete
                    </button>
                </div>
                <hr>
            `;
        }).join("");

    } catch (err) {
        console.error("History error:", err);
    }
}

// ================= VIEW SINGLE =================
async function viewPrediction(id) {
    try {
        const res = await fetch(`${BASE_URL}/api/predictions/${id}`);
        const result = await res.json();

        if (!result.success) return;

        const p = result.data;
        const info = getSafeClassInfo(p.predictedClass);

        document.getElementById('modalBody').innerHTML = `
            <img src="${BASE_URL}/uploads/${p.filename}" style="width:100%;border-radius:10px;">
            <h3>${info.emoji} ${info.label}</h3>
            <p>Confidence: ${(p.confidence ?? 0).toFixed(2)}%</p>
            <p>Date: ${new Date(p.createdAt).toLocaleString()}</p>
        `;

        predictionModal.style.display = "block";

    } catch (err) {
        console.error(err);
    }
}

// ================= DELETE =================
async function deletePrediction(id, event) {
    event.stopPropagation();

    if (!confirm("Delete this prediction?")) return;

    try {
        await fetch(`${BASE_URL}/api/predictions/${id}`, {
            method: "DELETE"
        });

        loadPredictionHistory();

    } catch (err) {
        console.error(err);
    }
}

// ================= TOGGLE HISTORY =================
function toggleHistoryView() {
    historySection.style.display =
        historySection.style.display === 'none' ? 'block' : 'none';

    if (historySection.style.display === 'block') {
        loadPredictionHistory();
    }
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App started");
    loadPredictionHistory();
});