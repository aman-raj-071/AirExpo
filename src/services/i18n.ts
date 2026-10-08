export type AppLanguage = 'EN' | 'HI' | 'KN';

const hi: Record<string, string> = {
  'Now': 'अभी', 'Satellite': 'उपग्रह', 'Timeline': 'समयरेखा', 'Routes': 'मार्ग', 'Places': 'स्थान', 'Alerts': 'अलर्ट',
  'Sign In': 'साइन इन', 'Sign Out': 'साइन आउट', 'Analyze': 'विश्लेषण करें', 'Use my location': 'मेरा स्थान उपयोग करें',
  'Precision Atmospheric Health Engine': 'सटीक वायुमंडलीय स्वास्थ्य इंजन',
  'Know when to ': 'जानें कब ', '/breathe easier.': '/आसानी से सांस लें।',
  'Air quality, micro-weather, and hyper-personalized bio-advice — calibrated into one distinct human decision.': 'वायु गुणवत्ता, सूक्ष्म मौसम और व्यक्तिगत स्वास्थ्य सलाह—एक स्पष्ट निर्णय के लिए।',
  'Quick telemetry:': 'त्वरित टेलीमेट्री:', 'Live Simulation': 'लाइव सिमुलेशन', 'Tailor Bio-Thresholds:': 'व्यक्तिगत स्वास्थ्य सीमा:',
  'General': 'सामान्य', 'Asthma': 'अस्थमा', 'Child': 'बच्चा', 'Elderly': 'वरिष्ठ', 'Athlete': 'खिलाड़ी',
  'Prescribed Action': 'सुझाई गई कार्रवाई', 'Surface Atmospheric Mechanics': 'स्थानीय वायुमंडलीय स्थिति',
  'Ground Sensor': 'ग्राउंड सेंसर', 'Temp': 'तापमान', 'Humidity': 'नमी', 'Wind': 'हवा', 'Precip': 'वर्षा', 'Venting': 'वेंटिलेशन',
  'Targeted Bio-Directives': 'व्यक्तिगत स्वास्थ्य निर्देश', 'What should you do?': 'आपको क्या करना चाहिए?',
  'DO NOW': 'अभी करें', 'AVOID': 'बचें', 'PLAN': 'योजना',
  'Personal protection workspace': 'व्यक्तिगत सुरक्षा कार्यक्षेत्र', 'Profile, journal and “what if?” simulator': 'प्रोफ़ाइल, जर्नल और “क्या हो यदि?” सिम्युलेटर',
  'Profile': 'प्रोफ़ाइल', 'Journal': 'जर्नल', 'Simulator': 'सिम्युलेटर', 'Everyday': 'दैनिक', 'Asthma care': 'अस्थमा देखभाल',
  'Age range': 'आयु वर्ग', 'Usual outdoor duration': 'सामान्य बाहरी अवधि', 'Known triggers (optional)': 'ज्ञात ट्रिगर (वैकल्पिक)',
  'Save profile': 'प्रोफ़ाइल सहेजें', 'Clear local health data': 'स्थानीय स्वास्थ्य डेटा हटाएँ',
  'Real-Time Satellite & Optical Remote Sensing': 'रीयल-टाइम उपग्रह और ऑप्टिकल रिमोट सेंसिंग',
  'Your 24-Hour Breathing Timeline': 'आपकी 24-घंटे की श्वसन समयरेखा', 'Visual Bars': 'विज़ुअल बार', 'Accessible List': 'सुलभ सूची',
  'Take the Cleaner Way': 'स्वच्छ मार्ग चुनें', 'Walk': 'पैदल', 'Cycle': 'साइकिल', 'Run': 'दौड़', 'Origin': 'आरंभ', 'Destination': 'गंतव्य',
  'Cleanest Route': 'सबसे स्वच्छ मार्ग', 'Fastest Route': 'सबसे तेज़ मार्ग', 'Recommended': 'अनुशंसित',
  'Saved Micro-Zones': 'सहेजे गए सूक्ष्म क्षेत्र', 'Add place': 'स्थान जोड़ें', 'Manage all places': 'सभी स्थान प्रबंधित करें',
  'Real-Time Air Alerts': 'रीयल-टाइम वायु अलर्ट', 'Push Notifications': 'पुश सूचनाएँ', 'SMS Critical Alerts': 'एसएमएस गंभीर अलर्ट',
  'Save Alert Preferences': 'अलर्ट प्राथमिकताएँ सहेजें', 'Continue with Email': 'ईमेल से जारी रखें',
  'Sign in with Passkey / Phone': 'पासकी / फोन से साइन इन करें', 'Email address': 'ईमेल पता',
  'Sign in to unlock your personal health workspace': 'व्यक्तिगत स्वास्थ्य कार्यक्षेत्र खोलने के लिए साइन इन करें',
};

const kn: Record<string, string> = {
  'Now': 'ಈಗ', 'Satellite': 'ಉಪಗ್ರಹ', 'Timeline': 'ಸಮಯರೇಖೆ', 'Routes': 'ಮಾರ್ಗಗಳು', 'Places': 'ಸ್ಥಳಗಳು', 'Alerts': 'ಎಚ್ಚರಿಕೆಗಳು',
  'Sign In': 'ಸೈನ್ ಇನ್', 'Sign Out': 'ಸೈನ್ ಔಟ್', 'Analyze': 'ವಿಶ್ಲೇಷಿಸಿ', 'Use my location': 'ನನ್ನ ಸ್ಥಳ ಬಳಸಿ',
  'Precision Atmospheric Health Engine': 'ನಿಖರ ವಾತಾವರಣ ಆರೋಗ್ಯ ಎಂಜಿನ್',
  'Know when to ': 'ಯಾವಾಗ ', '/breathe easier.': '/ಸುಲಭವಾಗಿ ಉಸಿರಾಡಬೇಕು ತಿಳಿಯಿರಿ.',
  'Air quality, micro-weather, and hyper-personalized bio-advice — calibrated into one distinct human decision.': 'ಗಾಳಿಯ ಗುಣಮಟ್ಟ, ಸೂಕ್ಷ್ಮ ಹವಾಮಾನ ಮತ್ತು ವೈಯಕ್ತಿಕ ಆರೋಗ್ಯ ಸಲಹೆ—ಒಂದು ಸ್ಪಷ್ಟ ನಿರ್ಧಾರಕ್ಕಾಗಿ.',
  'Quick telemetry:': 'ತ್ವರಿತ ಟೆಲಿಮೆಟ್ರಿ:', 'Live Simulation': 'ಲೈವ್ ಸಿಮ್ಯುಲೇಶನ್', 'Tailor Bio-Thresholds:': 'ವೈಯಕ್ತಿಕ ಆರೋಗ್ಯ ಮಿತಿಗಳು:',
  'General': 'ಸಾಮಾನ್ಯ', 'Asthma': 'ಆಸ್ತಮಾ', 'Child': 'ಮಗು', 'Elderly': 'ಹಿರಿಯರು', 'Athlete': 'ಕ್ರೀಡಾಪಟು',
  'Prescribed Action': 'ಸೂಚಿಸಿದ ಕ್ರಮ', 'Surface Atmospheric Mechanics': 'ಸ್ಥಳೀಯ ವಾತಾವರಣ ಸ್ಥಿತಿ',
  'Ground Sensor': 'ನೆಲ ಸಂವೇದಕ', 'Temp': 'ತಾಪಮಾನ', 'Humidity': 'ಆರ್ದ್ರತೆ', 'Wind': 'ಗಾಳಿ', 'Precip': 'ಮಳೆ', 'Venting': 'ಗಾಳಿ ಹರಿವು',
  'Targeted Bio-Directives': 'ವೈಯಕ್ತಿಕ ಆರೋಗ್ಯ ಸೂಚನೆಗಳು', 'What should you do?': 'ನೀವು ಏನು ಮಾಡಬೇಕು?',
  'DO NOW': 'ಈಗ ಮಾಡಿ', 'AVOID': 'ತಪ್ಪಿಸಿ', 'PLAN': 'ಯೋಜನೆ',
  'Personal protection workspace': 'ವೈಯಕ್ತಿಕ ರಕ್ಷಣಾ ಕಾರ್ಯಕ್ಷೇತ್ರ', 'Profile, journal and “what if?” simulator': 'ಪ್ರೊಫೈಲ್, ಜರ್ನಲ್ ಮತ್ತು “ಏನಾದರೆ?” ಸಿಮ್ಯುಲೇಟರ್',
  'Profile': 'ಪ್ರೊಫೈಲ್', 'Journal': 'ಜರ್ನಲ್', 'Simulator': 'ಸಿಮ್ಯುಲೇಟರ್', 'Everyday': 'ದೈನಂದಿನ', 'Asthma care': 'ಆಸ್ತಮಾ ಆರೈಕೆ',
  'Age range': 'ವಯಸ್ಸಿನ ಶ್ರೇಣಿ', 'Usual outdoor duration': 'ಸಾಮಾನ್ಯ ಹೊರಾಂಗಣ ಅವಧಿ', 'Known triggers (optional)': 'ತಿಳಿದಿರುವ ಪ್ರಚೋದಕಗಳು (ಐಚ್ಛಿಕ)',
  'Save profile': 'ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ', 'Clear local health data': 'ಸ್ಥಳೀಯ ಆರೋಗ್ಯ ಡೇಟಾ ಅಳಿಸಿ',
  'Real-Time Satellite & Optical Remote Sensing': 'ನೈಜ-ಸಮಯ ಉಪಗ್ರಹ ಮತ್ತು ಆಪ್ಟಿಕಲ್ ರಿಮೋಟ್ ಸೆನ್ಸಿಂಗ್',
  'Your 24-Hour Breathing Timeline': 'ನಿಮ್ಮ 24-ಗಂಟೆಗಳ ಉಸಿರಾಟ ಸಮಯರೇಖೆ', 'Visual Bars': 'ದೃಶ್ಯ ಪಟ್ಟಿಗಳು', 'Accessible List': 'ಸುಲಭ ಪಟ್ಟಿ',
  'Take the Cleaner Way': 'ಸ್ವಚ್ಛ ಮಾರ್ಗ ಆಯ್ಕೆಮಾಡಿ', 'Walk': 'ನಡೆ', 'Cycle': 'ಸೈಕಲ್', 'Run': 'ಓಟ', 'Origin': 'ಆರಂಭ', 'Destination': 'ಗಮ್ಯಸ್ಥಾನ',
  'Cleanest Route': 'ಅತ್ಯಂತ ಸ್ವಚ್ಛ ಮಾರ್ಗ', 'Fastest Route': 'ವೇಗವಾದ ಮಾರ್ಗ', 'Recommended': 'ಶಿಫಾರಸು',
  'Saved Micro-Zones': 'ಉಳಿಸಿದ ಸೂಕ್ಷ್ಮ ಪ್ರದೇಶಗಳು', 'Add place': 'ಸ್ಥಳ ಸೇರಿಸಿ', 'Manage all places': 'ಎಲ್ಲಾ ಸ್ಥಳ ನಿರ್ವಹಿಸಿ',
  'Real-Time Air Alerts': 'ನೈಜ-ಸಮಯ ಗಾಳಿ ಎಚ್ಚರಿಕೆಗಳು', 'Push Notifications': 'ಪುಶ್ ಸೂಚನೆಗಳು', 'SMS Critical Alerts': 'ಎಸ್‌ಎಂಎಸ್ ಗಂಭೀರ ಎಚ್ಚರಿಕೆಗಳು',
  'Save Alert Preferences': 'ಎಚ್ಚರಿಕೆ ಆದ್ಯತೆ ಉಳಿಸಿ', 'Continue with Email': 'ಇಮೇಲ್ ಮೂಲಕ ಮುಂದುವರಿಸಿ',
  'Sign in with Passkey / Phone': 'ಪಾಸ್‌ಕಿ / ಫೋನ್ ಮೂಲಕ ಸೈನ್ ಇನ್', 'Email address': 'ಇಮೇಲ್ ವಿಳಾಸ',
  'Sign in to unlock your personal health workspace': 'ವೈಯಕ್ತಿಕ ಆರೋಗ್ಯ ಕಾರ್ಯಕ್ಷೇತ್ರ ತೆರೆಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ',
};

const originalText = new WeakMap<Text, string>();

export function translateDocument(language: AppLanguage) {
  const dictionary = language === 'HI' ? hi : language === 'KN' ? kn : {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
      const current = node.nodeValue || '';

      // English is the React-rendered source of truth. Refresh the stored value
      // instead of restoring an older render (for example, the previous city/AQI).
      if (language === 'EN') {
        originalText.set(node, current);
        node = walker.nextNode() as Text | null;
        continue;
      }

      if (!originalText.has(node)) originalText.set(node, current);
      let source = originalText.get(node) || '';
      const sourceKey = source.trim();
      const renderedTranslation = dictionary[sourceKey]
        ? source.replace(sourceKey, dictionary[sourceKey])
        : source;

      // React may reuse a text node when live content changes. If the current
      // value is neither its source nor our translation, treat it as new data.
      if (current !== source && current !== renderedTranslation) {
        source = current;
        originalText.set(node, source);
      }
      const trimmed = source.trim();
      const next = dictionary[trimmed] ? source.replace(trimmed, dictionary[trimmed]) : current;
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    node = walker.nextNode() as Text | null;
  }
  document.documentElement.lang = language === 'HI' ? 'hi' : language === 'KN' ? 'kn' : 'en';
}
