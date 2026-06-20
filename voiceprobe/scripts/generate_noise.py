import os
import wave
import struct
import random

def generate_white_noise(filename, duration_sec=5, sample_rate=24000):
    """Generates pure static/white noise."""
    print(f"Generating {filename}...")
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)
        
        for _ in range(int(sample_rate * duration_sec)):
            value = random.randint(-32767, 32767)
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)

def generate_brown_noise(filename, duration_sec=5, sample_rate=24000):
    """Generates a deep rumble, simulating a car interior on a highway."""
    print(f"Generating {filename}...")
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        last_val = 0.0
        for _ in range(int(sample_rate * duration_sec)):
            white = random.uniform(-1, 1)
            # Brown noise is integrated white noise (leaky integrator)
            last_val = (last_val + (0.02 * white)) / 1.02
            
            # Scale up and clamp
            out_val = int(last_val * 32767 * 3.0) 
            out_val = max(-32767, min(32767, out_val))
            
            data = struct.pack('<h', out_val)
            wav_file.writeframesraw(data)

def main():
    assets_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'noise')
    os.makedirs(assets_dir, exist_ok=True)
    
    generate_white_noise(os.path.join(assets_dir, 'static.wav'), duration_sec=10)
    generate_brown_noise(os.path.join(assets_dir, 'car.wav'), duration_sec=10)
    # Re-use brown noise as generic background rumble
    generate_brown_noise(os.path.join(assets_dir, 'street.wav'), duration_sec=10)
    
    print("Done generating noise profiles!")

if __name__ == '__main__':
    main()
