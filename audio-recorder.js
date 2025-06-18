// --- Audio Recorder Class ---
class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
    }

    async startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Media Devices API not supported on this browser.');
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = event => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
        } catch (error) {
            console.error("Recording failed:", error);
            throw new Error("Microphone access was denied. Please allow it in your browser settings.");
        }
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                return resolve(null);
            }
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.isRecording = false;
                this.stream.getTracks().forEach(track => track.stop()); // Release microphone
                resolve(audioBlob);
            };
            this.mediaRecorder.stop();
        });
    }

    async uploadAudio(blob, postId) {
        if (!blob) throw new Error("No audio blob to upload.");
        const fileRef = firebase.storage().ref(`audio/${postId}/${Date.now()}.webm`);
        await fileRef.put(blob);
        return await fileRef.getDownloadURL();
    }
}
