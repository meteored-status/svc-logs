export async function AnimationFrame(callback: FrameRequestCallback): Promise<void> {
    return new Promise<void>((resolve: Function) => {
        requestAnimationFrame((timestamp) => {
            callback(timestamp);

            resolve();
        });
    });
}
