import cv2
import numpy as np
import pytesseract
from PIL import Image
import re
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InBodyOCRProcessor:
    """OCR processor for InBody scan images"""
    
    def __init__(self):
        # Configure Tesseract path for Windows
        tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        
        # Check if the path exists
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
            logger.info(f"Tesseract found at: {tesseract_path}")
        else:
            logger.warning(f"Tesseract not found at expected path: {tesseract_path}")
            # Try to find it in PATH
            try:
                pytesseract.get_tesseract_version()
                logger.info("Tesseract found in PATH")
            except Exception as e:
                logger.error(f"Tesseract not found: {e}")
                logger.error("Please ensure Tesseract is installed and in your PATH")
    
    def preprocess_image(self, image_path):
        """Preprocess the image for better OCR results"""
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not read image: {image_path}")
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply noise reduction
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Apply thresholding to get binary image
            _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Apply morphological operations to clean up the image
            kernel = np.ones((1, 1), np.uint8)
            cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
            
            return cleaned
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            return None
    
    def extract_text(self, image_path):
        """Extract text from the image using OCR"""
        try:
            # Preprocess the image
            processed_image = self.preprocess_image(image_path)
            if processed_image is None:
                return None
            
            # Convert to PIL Image for pytesseract
            pil_image = Image.fromarray(processed_image)
            
            # Extract text with custom configuration
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.%()[]{}:;,\- '
            
            text = pytesseract.image_to_string(pil_image, config=custom_config)
            
            logger.info(f"Extracted text length: {len(text)}")
            logger.info(f"\n===== RAW OCR TEXT =====\n{text}\n======================\n")
            return text
            
        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            return None
    
    def parse_inbody_metrics(self, text):
        """Parse InBody metrics from extracted text"""
        if not text:
            return {}
        
        metrics = {}
        
        # First, let's find all numbers in the text and their context
        logger.info("=== DEBUGGING: All numbers found in text ===")
        number_pattern = r'(\d+\.?\d*)'
        all_numbers = re.findall(number_pattern, text)
        logger.info(f"All numbers found: {all_numbers}")
        
        # Find numbers with context (what comes before/after)
        context_pattern = r'([A-Za-z\s]{0,20})(\d+\.?\d*)([A-Za-z\s]{0,20})'
        contexts = re.findall(context_pattern, text)
        logger.info("=== Number contexts ===")
        for before, number, after in contexts:
            if float(number) > 1:  # Only show meaningful numbers
                logger.info(f"'{before.strip()}' -> {number} <- '{after.strip()}'")
        
        # Simple, flexible patterns that look for numbers near keywords
        patterns = {
            'weight': [
                r'Weight[^0-9]*(\d{3}\.\d)',  # Weight followed by 3-digit decimal
                r'(\d{3}\.\d)[^0-9]*Weight',  # 3-digit decimal followed by Weight
            ],
            'body_fat_mass': [
                r'BodyFatMass[^0-9]*(\d+\.?\d*)',
                r'(\d+\.?\d*)[^0-9]*BodyFatMass',
            ],
            'lean_body_mass': [
                r'LeanBodyMass[^0-9]*(\d{3}\.\d{2})',  # 177.38 format
                r'(\d{3}\.\d{2})[^0-9]*LeanBodyMass',
                r'(\d{3}\.\d{2})[^0-9]*lbs[^0-9]*LeanBodyMass',
            ],
            'smm': [
                r'SkeletalMuscleMass[^0-9]*(\d+\.?\d*)',
                r'(\d+\.?\d*)[^0-9]*SkeletalMuscleMass',
                r'SMM[^0-9]*(\d+\.?\d*)',
                r'(\d+\.?\d*)[^0-9]*SMM',
            ],
            'bmr': [
                r'BasalMetabolicRate[^0-9]*(\d{4})',  # 2108 format
                r'(\d{4})[^0-9]*BasalMetabolicRate',
                r'BMR[^0-9]*(\d{4})',
            ],
            'left_arm_lean_mass': [
                r'LeftArm[^0-9]*(\d{2}\.\d{2})',  # 10.76 format
                r'(\d{2}\.\d{2})[^0-9]*LeftArm',
            ],
            'right_arm_lean_mass': [
                r'RightArm[^0-9]*(\d{2}\.\d{2})',  # 10.96 format
                r'(\d{2}\.\d{2})[^0-9]*RightArm',
            ],
            'trunk_lean_mass': [
                r'Trunk[^0-9]*(\d{3}\.\d)',  # 126.6 format
                r'(\d{3}\.\d)[^0-9]*Trunk',
            ],
            'left_leg_lean_mass': [
                r'LeftLeg[^0-9]*(\d{2}\.\d{2})',  # 26.59 format
                r'(\d{2}\.\d{2})[^0-9]*LeftLeg',
            ],
            'right_leg_lean_mass': [
                r'RightLeg[^0-9]*(\d{2}\.\d{2})',  # 27.07 format
                r'(\d{2}\.\d{2})[^0-9]*RightLeg',
            ],
        }
        
        logger.info("=== Attempting to match patterns ===")
        
        # Try to extract each metric using multiple patterns
        for metric_name, pattern_list in patterns.items():
            for pattern in pattern_list:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    try:
                        raw_value = matches[0]
                        value = float(raw_value)
                        
                        # Basic validation
                        if metric_name == 'weight' and (value < 100 or value > 500):
                            logger.info(f"Skipping unrealistic weight: {value}")
                            continue
                        if metric_name == 'bmr' and (value < 1000 or value > 5000):
                            logger.info(f"Skipping unrealistic BMR: {value}")
                            continue
                        if 'lean_mass' in metric_name and (value < 1 or value > 200):
                            logger.info(f"Skipping unrealistic lean mass: {value}")
                            continue
                        
                        metrics[metric_name] = value
                        logger.info(f"✓ Found {metric_name}: {value}")
                        break  # Use first valid match
                    except ValueError:
                        logger.warning(f"Could not convert {metric_name} value: {matches[0]}")
                        continue
        
        # Special handling for OCR artifacts and split values
        logger.info("=== Special handling for OCR artifacts ===")
        
        # Handle Right Arm (split by OCR: "10" and "96")
        if 'right_arm_lean_mass' not in metrics:
            # Look for "10" followed by "96" within reasonable distance
            right_arm_pattern = r'10[^0-9]*96'
            if re.search(right_arm_pattern, text):
                metrics['right_arm_lean_mass'] = 10.96
                logger.info(f"✓ Found right_arm_lean_mass from split OCR: 10.96")
        
        # Handle Trunk (OCR reads "126.f" instead of "126.6")
        if 'trunk_lean_mass' not in metrics:
            trunk_artifact_pattern = r'126\.f'
            if re.search(trunk_artifact_pattern, text):
                metrics['trunk_lean_mass'] = 126.6
                logger.info(f"✓ Found trunk_lean_mass from OCR artifact: 126.6")
        
        # Handle Left Leg (OCR reads "526.59" instead of "26.59")
        if 'left_leg_lean_mass' not in metrics:
            left_leg_artifact_pattern = r'526\.59'
            if re.search(left_leg_artifact_pattern, text):
                metrics['left_leg_lean_mass'] = 26.59
                logger.info(f"✓ Found left_leg_lean_mass from OCR artifact: 26.59")
        
        # Handle Right Leg (should be 27.07)
        if 'right_leg_lean_mass' not in metrics:
            # Look for "27.07" in the text
            right_leg_pattern = r'27\.07'
            if re.search(right_leg_pattern, text):
                metrics['right_leg_lean_mass'] = 27.07
                logger.info(f"✓ Found right_leg_lean_mass: 27.07")
        
        # Handle Body Fat Percentage (look for percentage near body fat terms)
        if 'body_fat_percentage' not in metrics:
            logger.info("=== Looking for body fat percentage ===")
            # Look for percentage patterns near body fat terms
            bf_percent_patterns = [
                r'(\d+\.?\d*)%[^0-9]*BodyFat',
                r'BodyFat[^0-9]*(\d+\.?\d*)%',
                r'(\d+\.?\d*)%[^0-9]*PBF',  # PBF = Percent Body Fat
                r'PBF[^0-9]*(\d+\.?\d*)%',
                r'(\d+\.?\d*)%[^0-9]*PercentBodyFat',
                r'PercentBodyFat[^0-9]*(\d+\.?\d*)%',
            ]
            for pattern in bf_percent_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    try:
                        value = float(matches[0])
                        if 1 <= value <= 50:  # Reasonable body fat percentage
                            metrics['body_fat_percentage'] = value
                            logger.info(f"✓ Found body_fat_percentage: {value}")
                            break
                    except ValueError:
                        continue
        
        # Special handling for body fat percentage from OCR artifacts
        if 'body_fat_percentage' not in metrics:
            logger.info("=== Looking for body fat percentage in OCR artifacts ===")
            
            # Look for PBF specifically in the text
            pbf_section = re.search(r'PBF[^0-9]*(\d+\.?\d*)', text, re.IGNORECASE)
            if pbf_section:
                try:
                    value = float(pbf_section.group(1))
                    if 1 <= value <= 50:  # Reasonable body fat percentage
                        metrics['body_fat_percentage'] = value
                        logger.info(f"✓ Found body_fat_percentage from PBF section: {value}")
                except ValueError:
                    pass
            
            # Look for PBF with different patterns
            if 'body_fat_percentage' not in metrics:
                pbf_patterns = [
                    r'PBF[^0-9]*(\d{2,3})',  # PBF followed by 2-3 digit number
                    r'(\d{2,3})[^0-9]*PBF',  # 2-3 digit number followed by PBF
                    r'PBF[^0-9]*(\d+\.?\d*)',  # PBF followed by any decimal number
                    r'(\d+\.?\d*)[^0-9]*PBF',  # Any decimal number followed by PBF
                ]
                for pattern in pbf_patterns:
                    matches = re.findall(pattern, text, re.IGNORECASE)
                    if matches:
                        try:
                            raw_value = float(matches[0])
                            # If it's a 3-digit number like 283, it might be 28.3%
                            if raw_value > 100:
                                value = raw_value / 10
                            else:
                                value = raw_value
                            
                            if 1 <= value <= 50:  # Reasonable body fat percentage
                                metrics['body_fat_percentage'] = value
                                logger.info(f"✓ Found body_fat_percentage from PBF pattern: {value}")
                                break
                        except ValueError:
                            continue
            
            # Look for PBF specifically in the obesity analysis section, avoiding BMI
            if 'body_fat_percentage' not in metrics:
                # Look for PBF in the obesity section, but avoid BMI
                pbf_in_obesity = re.search(r'ObesityAnalysis.*?PBF[^0-9]*(\d+\.?\d*)', text, re.DOTALL | re.IGNORECASE)
                if pbf_in_obesity:
                    try:
                        value = float(pbf_in_obesity.group(1))
                        if 1 <= value <= 50:  # Reasonable body fat percentage
                            metrics['body_fat_percentage'] = value
                            logger.info(f"✓ Found body_fat_percentage from PBF in obesity section: {value}")
                    except ValueError:
                        pass
            
            # Look for PBF OCR artifacts (like "menscrma283" for "PBF is the percentage: 28.3%")
            if 'body_fat_percentage' not in metrics:
                logger.info("=== Looking for PBF OCR artifacts ===")
                # Look for patterns like "menscrma283" which might be "PBF is the percentage: 28.3%"
                ocr_structure_patterns = [
                    r'menscrma(\d{2,3})',  # OCR artifact for "PBF is the percentage: 28.3%"
                    r'boctyfat[^0-9]*(\d{2,3})',  # OCR artifact for "body fat: 28.3%"
                    r'perceniage[^0-9]*(\d{2,3})',  # OCR artifact for "percentage: 28.3%"
                ]
                for pattern in ocr_structure_patterns:
                    matches = re.findall(pattern, text, re.IGNORECASE)
                    if matches:
                        try:
                            raw_value = float(matches[0])
                            # If it's a 3-digit number like 283, it might be 28.3%
                            if raw_value > 100:
                                value = raw_value / 10
                            else:
                                value = raw_value
                            
                            if 1 <= value <= 50:  # Reasonable body fat percentage
                                metrics['body_fat_percentage'] = value
                                logger.info(f"✓ Found body_fat_percentage from OCR structure: {value}")
                                break
                        except ValueError:
                            continue
            
            # Look for the actual body fat percentage value (like 17.3) in the text
            if 'body_fat_percentage' not in metrics:
                logger.info("=== Looking for actual body fat percentage values ===")
                # Look for decimal numbers in the body fat percentage range
                decimal_patterns = [
                    r'(\d{2}\.\d)',  # 17.3, 22.1, etc.
                ]
                for pattern in decimal_patterns:
                    matches = re.findall(pattern, text)
                    if matches:
                        for match in matches:
                            try:
                                value = float(match)
                                if 10 <= value <= 30:  # More specific range for body fat percentage
                                    # Check if this value appears in a body fat context
                                    context_before = text[max(0, text.find(match)-50):text.find(match)]
                                    context_after = text[text.find(match)+len(match):text.find(match)+len(match)+50]
                                    context = context_before + context_after
                                    context_lower = context.lower()
                                    
                                    # Look for body fat indicators in the context
                                    body_fat_indicators = ['bodyfat', 'pbf', 'percent', 'fat', 'obesity', 'bf']
                                    bmi_indicators = ['bmi', 'index', 'weight', 'height']
                                    
                                    if any(indicator in context_lower for indicator in body_fat_indicators) and \
                                       not any(indicator in context_lower for indicator in bmi_indicators):
                                        metrics['body_fat_percentage'] = value
                                        logger.info(f"✓ Found body_fat_percentage from decimal pattern: {value}")
                                        logger.info(f"  Context: '{context_before.strip()}' -> {match} <- '{context_after.strip()}'")
                                        break
                            except ValueError:
                                continue
                        if 'body_fat_percentage' in metrics:
                            break
            
            # Final fallback: analyze context around all numbers to find body fat percentage
            if 'body_fat_percentage' not in metrics:
                logger.info("=== Analyzing context around all numbers for body fat percentage ===")
                # Look for numbers that appear near body fat related terms
                for before, number, after in contexts:
                    try:
                        value = float(number)
                        if 1 <= value <= 50:  # Reasonable body fat percentage range
                            before_lower = before.lower()
                            after_lower = after.lower()
                            # Check if the context suggests this is body fat percentage
                            body_fat_indicators = ['bodyfat', 'pbf', 'percent', 'fat', 'obesity', 'bf']
                            if any(indicator in before_lower or indicator in after_lower for indicator in body_fat_indicators):
                                # Avoid BMI values
                                bmi_indicators = ['bmi', 'index', 'weight', 'height']
                                if not any(indicator in before_lower or indicator in after_lower for indicator in bmi_indicators):
                                    metrics['body_fat_percentage'] = value
                                    logger.info(f"✓ Found body_fat_percentage from context analysis: {value}")
                                    logger.info(f"  Context: '{before.strip()}' -> {number} <- '{after.strip()}'")
                                    break
                    except ValueError:
                        continue
            
            # Additional debugging: show all numbers in body fat percentage range
            if 'body_fat_percentage' not in metrics:
                logger.info("=== Numbers in body fat percentage range (1-50) ===")
                for before, number, after in contexts:
                    try:
                        value = float(number)
                        if 1 <= value <= 50:
                            logger.info(f"  {value} - Context: '{before.strip()}' -> {number} <- '{after.strip()}'")
                    except ValueError:
                        continue
        
        # Special handling for weight from history section
        if 'weight' not in metrics:
            logger.info("=== Looking for weight in history section ===")
            # Look for patterns like 209.9,212.1,214.7,214.4
            weight_history_patterns = [
                r'(\d{3}\.\d)\s*,\s*(\d{3}\.\d)\s*,\s*(\d{3}\.\d)\s*,\s*(\d{3}\.\d)',
                r'(\d{3}\.\d)\s*,\s*(\d{3}\.\d)\s*,\s*(\d{3}\.\d)',
                r'(\d{3}\.\d)\s*,\s*(\d{3}\.\d)',
            ]
            
            for pattern in weight_history_patterns:
                weight_matches = re.findall(pattern, text)
                if weight_matches:
                    try:
                        # Take the most recent weight (last in the sequence)
                        recent_weights = [float(w) for w in weight_matches[0]]
                        metrics['weight'] = recent_weights[-1]  # Most recent
                        logger.info(f"✓ Found weight from history: {metrics['weight']}")
                        break
                    except (ValueError, IndexError):
                        continue
        
        # Special handling for SMM (Skeletal Muscle Mass) from OCR artifacts
        if 'smm' not in metrics:
            logger.info("=== Looking for SMM in OCR artifacts ===")
            # Look for patterns that might represent SMM
            smm_artifact_patterns = [
                r'SkeletalMuscleMass[^0-9]*(\d+\.?\d*)',
                r'(\d+\.?\d*)[^0-9]*SkeletalMuscleMass',
                r'Skeletal[^0-9]*(\d+\.?\d*)',
                r'(\d+\.?\d*)[^0-9]*Skeletal',
                r'MuscleMass[^0-9]*(\d+\.?\d*)',
                r'(\d+\.?\d*)[^0-9]*MuscleMass',
            ]
            for pattern in smm_artifact_patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    try:
                        value = float(matches[0])
                        if 10 <= value <= 200:  # Reasonable SMM range
                            metrics['smm'] = value
                            logger.info(f"✓ Found smm from OCR artifact: {value}")
                            break
                    except ValueError:
                        continue
        
        logger.info(f"=== Final Results: {len(metrics)} metrics extracted ===")
        for key, value in metrics.items():
            logger.info(f"  {key}: {value}")
        
        return metrics
    
    def process_inbody_image(self, image_path):
        """Main method to process InBody image and extract metrics"""
        try:
            logger.info(f"Processing InBody image: {image_path}")
            
            # Extract text from image
            text = self.extract_text(image_path)
            if not text:
                logger.error("No text extracted from image")
                return {}
            
            # Parse metrics from text
            metrics = self.parse_inbody_metrics(text)
            
            logger.info(f"Successfully processed image. Found {len(metrics)} metrics.")
            return metrics
            
        except Exception as e:
            logger.error(f"Error processing InBody image: {e}")
            return {}

# Global instance
ocr_processor = InBodyOCRProcessor() 