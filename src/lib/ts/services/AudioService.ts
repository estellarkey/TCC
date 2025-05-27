export class AudioService {
    private static sounds: Record<string, HTMLAudioElement> = {};
    private static basePath = '/sounds/';
    private static activeSounds: Set<string> = new Set();

    // Controle exclusivo para tocar 'danger' apenas uma vez
    private static dangerPlayedOnce = false;

    public static async loadSounds(): Promise<void> {
        try {
            const soundFiles = {
                'move': 'move.mp3',
                'capture': 'capture.mp3',
                'check': 'check.mp3',
                'danger': 'danger-zone.mp3'
            };

            for (const [name, file] of Object.entries(soundFiles)) {
                const audio = new Audio(`${this.basePath}${file}`);
                audio.volume = 1;
                audio.preload = 'auto';

                audio.addEventListener('ended', () => {
                    this.activeSounds.delete(name);

                });

                this.sounds[name] = audio;
            }

            console.log('[AudioService] Sons carregados');
        } catch (error) {
            console.error("Erro ao carregar sons:", error);
        }
    }

    public static play(soundName: string, loop: boolean = false): void {
        if (soundName === 'danger') {
            if (this.dangerPlayedOnce) {
                return;
            }
            this.dangerPlayedOnce = true;
        }

        const audio = this.sounds[soundName];
        if (!audio) {
            console.warn(`Som '${soundName}' não encontrado`);
            return;
        }

        const instance = loop ? audio : audio.cloneNode(true) as HTMLAudioElement;
        instance.volume = audio.volume;
        instance.loop = loop;
        instance.currentTime = 0;

        this.activeSounds.add(soundName);

        instance.addEventListener('ended', () => {
            this.activeSounds.delete(soundName);

        });

        instance.play().catch(err => {

            this.activeSounds.delete(soundName);
        });
    }

    public static setVolume(volume: number): void {
        Object.values(this.sounds).forEach(audio => {
            audio.volume = volume;
        });
    }
}
