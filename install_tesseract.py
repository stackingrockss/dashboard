import os
import sys
import subprocess
import urllib.request
import zipfile
from pathlib import Path

def download_tesseract():
    """Download and install Tesseract OCR for Windows"""
    print("Setting up Tesseract OCR...")
    
    # Tesseract download URL (latest stable version)
    tesseract_url = "https://github.com/UB-Mannheim/tesseract/releases/download/v5.3.3.20231005/tesseract-ocr-w64-setup-5.3.3.20231005.exe"
    
    # Download directory
    download_dir = Path.cwd() / "downloads"
    download_dir.mkdir(exist_ok=True)
    
    installer_path = download_dir / "tesseract-installer.exe"
    
    print(f"Downloading Tesseract installer from {tesseract_url}")
    print("This may take a few minutes...")
    
    try:
        urllib.request.urlretrieve(tesseract_url, installer_path)
        print(f"Download completed: {installer_path}")
        
        print("\nPlease run the installer manually:")
        print(f"1. Navigate to: {installer_path}")
        print("2. Run the installer as Administrator")
        print("3. Install to default location (C:\\Program Files\\Tesseract-OCR)")
        print("4. Add to PATH during installation")
        print("\nAfter installation, restart your terminal and run this script again to verify.")
        
    except Exception as e:
        print(f"Error downloading Tesseract: {e}")
        print("\nPlease download manually from:")
        print("https://github.com/UB-Mannheim/tesseract/releases")
        print("Look for the latest tesseract-ocr-w64-setup-*.exe file")
        print("\nManual Installation Steps:")
        print("1. Go to: https://github.com/UB-Mannheim/tesseract/releases")
        print("2. Download the latest tesseract-ocr-w64-setup-*.exe")
        print("3. Run the installer as Administrator")
        print("4. Install to: C:\\Program Files\\Tesseract-OCR")
        print("5. Make sure 'Add to PATH' is checked during installation")
        print("6. Restart your terminal/command prompt")
        print("7. Run this script again to verify installation")

def verify_tesseract():
    """Verify Tesseract is installed and accessible"""
    try:
        result = subprocess.run(['tesseract', '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("✓ Tesseract is installed and working!")
            print(f"Version: {result.stdout.strip()}")
            return True
        else:
            print("✗ Tesseract installation verification failed")
            return False
    except FileNotFoundError:
        print("✗ Tesseract not found in PATH")
        print("\nIf you've already installed Tesseract, try:")
        print("1. Restarting your terminal/command prompt")
        print("2. Adding C:\\Program Files\\Tesseract-OCR to your PATH manually")
        return False
    except Exception as e:
        print(f"✗ Error verifying Tesseract: {e}")
        return False

def main():
    print("Tesseract OCR Setup for Windows")
    print("=" * 40)
    
    if verify_tesseract():
        print("\nTesseract is ready to use!")
        return
    
    print("\nTesseract not found. Please install manually:")
    print("\nManual Installation Steps:")
    print("1. Go to: https://github.com/UB-Mannheim/tesseract/releases")
    print("2. Download the latest tesseract-ocr-w64-setup-*.exe")
    print("3. Run the installer as Administrator")
    print("4. Install to: C:\\Program Files\\Tesseract-OCR")
    print("5. Make sure 'Add to PATH' is checked during installation")
    print("6. Restart your terminal/command prompt")
    print("7. Run this script again to verify installation")

if __name__ == "__main__":
    main() 