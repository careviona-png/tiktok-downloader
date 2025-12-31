/**
 * Video Processing Utilities
 * For reversing videos using client-side processing
 */

/**
 * Get video reverse endpoint - Returns instructions for client-side processing
 * Since ffmpeg requires installation, we'll use client-side processing instead
 */
function getReverseInstructions() {
    return {
        method: 'client-side',
        instructions: 'Video will be reversed in browser using HTML5 Canvas and MediaRecorder API',
        note: 'This avoids server-side dependencies like ffmpeg'
    };
}

/**
 * Generate reverse video metadata
 */
function generateReverseMetadata(originalData) {
    return {
        ...originalData,
        title: `${originalData.title} (Reversed)`,
        isReversed: true,
        processedAt: new Date().toISOString()
    };
}

module.exports = {
    getReverseInstructions,
    generateReverseMetadata
};
