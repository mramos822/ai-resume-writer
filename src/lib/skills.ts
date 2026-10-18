// Common resume skills, grouped by field, for the skills autocomplete. People can still type anything that isn't here.
export const SKILL_GROUPS: Record<string, string[]> = {
  "Soft skills": [
    "Communication", "Teamwork", "Leadership", "Problem Solving", "Critical Thinking", "Time Management", "Adaptability",
    "Creativity", "Attention to Detail", "Organization", "Work Ethic", "Collaboration", "Conflict Resolution", "Decision Making",
    "Emotional Intelligence", "Active Listening", "Public Speaking", "Negotiation", "Customer Service", "Multitasking",
    "Self-Motivation", "Reliability", "Flexibility", "Mentoring", "Presentation Skills", "Interpersonal Skills", "Research",
    "Analytical Thinking", "Project Management", "Strategic Planning", "Initiative", "Stress Management", "Cultural Awareness",
  ],
  "Office & productivity": [
    "Microsoft Excel", "Microsoft Word", "Microsoft PowerPoint", "Microsoft Outlook", "Microsoft Office", "Google Workspace",
    "Google Sheets", "Google Docs", "Slack", "Zoom", "Trello", "Asana", "Notion", "Jira", "Confluence", "Data Entry", "Typing",
    "Scheduling", "Calendar Management", "Filing", "Record Keeping", "Report Writing", "Proofreading", "Editing", "Bookkeeping",
    "Spreadsheets", "Email Management", "Travel Coordination", "Minute Taking", "Office Administration",
  ],
  "Software development": [
    "JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Scala",
    "R", "Objective-C", "Assembly", "Lua", "Perl", "Haskell", "Julia", "Elixir", "VBA", "COBOL", "Fortran", "Verilog", "VHDL",
    "SQL Server", "MATLAB", "Bash", "PowerShell", "HTML", "CSS", "Sass", "React", "Next.js", "Vue.js", "Angular", "Svelte", "Redux",
    "Tailwind CSS", "Bootstrap", "jQuery", "Node.js", "Express.js", "Django", "Flask", "FastAPI", "Spring Boot", "Ruby on Rails",
    "Laravel", ".NET", "ASP.NET", "GraphQL", "REST APIs", "WebSockets", "Microservices", "SQL", "PostgreSQL", "MySQL", "SQLite",
    "MongoDB", "Redis", "Firebase", "Supabase", "Elasticsearch", "Git", "GitHub", "GitLab", "Bitbucket", "Docker", "Kubernetes",
    "Terraform", "Ansible", "Jenkins", "CI/CD", "GitHub Actions", "AWS", "Azure", "Google Cloud", "Linux", "Unix", "Nginx",
    "Agile", "Scrum", "Kanban", "Test-Driven Development", "Unit Testing", "Jest", "Cypress", "Selenium", "Playwright", "Postman",
    "Object-Oriented Programming", "Data Structures", "Algorithms", "System Design", "Design Patterns", "Debugging", "Code Review",
    "React Native", "Flutter", "iOS Development", "Android Development", "Unity", "Unreal Engine", "WordPress", "Shopify",
    "Responsive Design", "Web Accessibility", "Performance Optimization", "Technical Documentation", "Version Control",
  ],
  "Data & AI": [
    "Data Analysis", "Data Visualization", "Data Cleaning", "Statistics", "Machine Learning", "Deep Learning", "Natural Language Processing",
    "Computer Vision", "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy", "Jupyter", "Tableau", "Power BI", "Looker",
    "Google Analytics", "A/B Testing", "ETL", "Data Modeling", "Data Warehousing", "Snowflake", "BigQuery", "Apache Spark", "Hadoop",
    "Airflow", "dbt", "Excel Modeling", "Forecasting", "Predictive Modeling", "Prompt Engineering", "LLMs", "Big Data",
  ],
  "IT & cybersecurity": [
    "Technical Support", "Help Desk", "Troubleshooting", "Network Administration", "Active Directory", "Windows Server", "VMware",
    "Cybersecurity", "Network Security", "Penetration Testing", "Incident Response", "Vulnerability Assessment", "SIEM", "Firewalls",
    "VPN", "TCP/IP", "DNS", "Cloud Security", "Identity and Access Management", "Hardware Repair", "System Administration",
    "IT Support", "ITIL", "Backup and Recovery", "Endpoint Management", "Cisco", "CompTIA A+", "Security+",
  ],
  "Design & creative": [
    "Figma", "Adobe Photoshop", "Adobe Illustrator", "Adobe InDesign", "Adobe Premiere Pro", "After Effects", "Adobe XD", "Sketch",
    "Canva", "UI Design", "UX Design", "User Research", "Wireframing", "Prototyping", "Design Systems", "Typography", "Branding",
    "Logo Design", "Graphic Design", "Motion Graphics", "Video Editing", "Photography", "Photo Editing", "Illustration", "3D Modeling",
    "Blender", "AutoCAD", "SketchUp", "Storyboarding", "Copywriting", "Content Writing", "Creative Writing", "Storytelling",
    "Color Theory", "Layout Design", "Print Design", "Packaging Design", "Podcast Editing", "Audio Editing", "Animation",
  ],
  "Marketing & communications": [
    "Digital Marketing", "Social Media Marketing", "Content Marketing", "Email Marketing", "SEO", "SEM", "Google Ads", "Facebook Ads",
    "Influencer Marketing", "Brand Management", "Market Research", "Campaign Management", "Marketing Analytics", "HubSpot",
    "Mailchimp", "Hootsuite", "Buffer", "Public Relations", "Media Relations", "Press Releases", "Event Planning", "Copy Editing",
    "Community Management", "Social Media Strategy", "Marketing Strategy", "Growth Marketing", "Affiliate Marketing", "CRM",
    "Customer Segmentation", "Lead Generation", "Newsletter Writing", "Blogging", "Video Marketing", "TikTok", "Instagram",
  ],
  "Sales & customer service": [
    "Sales", "Cold Calling", "Lead Qualification", "Account Management", "Business Development", "Customer Relationship Management",
    "Salesforce", "Negotiation", "Closing Deals", "Upselling", "Customer Retention", "Customer Support", "Complaint Handling",
    "Order Processing", "Point of Sale", "Cash Handling", "Retail Sales", "Product Knowledge", "Merchandising", "Inventory Management",
    "Visual Merchandising", "Call Center", "Live Chat Support", "Zendesk", "Client Relations", "Sales Forecasting", "Prospecting",
    "Consultative Selling", "Customer Onboarding", "Troubleshooting Customer Issues",
  ],
  "Business, finance & accounting": [
    "Accounting", "Bookkeeping", "QuickBooks", "Financial Analysis", "Financial Reporting", "Financial Modeling", "Budgeting",
    "Forecasting", "Accounts Payable", "Accounts Receivable", "Payroll", "Auditing", "Tax Preparation", "Reconciliation", "GAAP",
    "Cost Analysis", "Risk Management", "Investment Analysis", "Valuation", "SAP", "Oracle", "Xero", "Compliance", "Credit Analysis",
    "Underwriting", "Banking", "Loan Processing", "Insurance", "Business Analysis", "Process Improvement", "Lean Six Sigma",
    "Operations Management", "Supply Chain Management", "Logistics", "Procurement", "Vendor Management", "Contract Management",
    "Business Planning", "Market Analysis", "Stakeholder Management", "Change Management", "Product Management", "Requirements Gathering",
    "Strategic Planning", "KPI Tracking", "Quality Assurance", "Project Planning", "Budget Management", "Team Management",
  ],
  "Human resources & recruiting": [
    "Recruiting", "Talent Acquisition", "Interviewing", "Onboarding", "Employee Relations", "Performance Management", "Benefits Administration",
    "HRIS", "Workday", "Applicant Tracking Systems", "Training and Development", "Compensation", "Labor Law", "Diversity and Inclusion",
    "Payroll Processing", "Policy Development", "Conflict Mediation", "Workforce Planning",
  ],
  "Healthcare": [
    "Patient Care", "CPR", "First Aid", "BLS Certified", "ACLS", "Vital Signs", "Medical Terminology", "Electronic Health Records",
    "Epic", "HIPAA Compliance", "Phlebotomy", "Medication Administration", "Wound Care", "Patient Assessment", "Infection Control",
    "Clinical Documentation", "Medical Coding", "Medical Billing", "Triage", "Patient Education", "Charting", "IV Therapy",
    "Pharmacy Operations", "Dental Assisting", "Lab Techniques", "Radiology", "Physical Therapy", "Mental Health Support",
    "Case Management", "Home Health Care", "Elder Care", "Emergency Response", "Nutrition Counseling", "Telehealth",
  ],
  "Education & training": [
    "Lesson Planning", "Curriculum Development", "Classroom Management", "Differentiated Instruction", "Student Assessment", "Tutoring",
    "Special Education", "Instructional Design", "Google Classroom", "Canvas", "Blackboard", "Educational Technology", "Public Speaking",
    "Mentoring", "Academic Advising", "Early Childhood Education", "ESL Teaching", "Test Preparation", "Student Engagement",
    "Parent Communication", "Coaching", "Workshop Facilitation", "Training Delivery", "E-Learning",
  ],
  "Engineering & science": [
    "AutoCAD", "SolidWorks", "CAD", "MATLAB", "Simulink", "LabVIEW", "PLC Programming", "Circuit Design", "PCB Design", "Arduino",
    "Raspberry Pi", "Embedded Systems", "3D Printing", "Prototyping", "Finite Element Analysis", "Thermodynamics", "Fluid Mechanics",
    "Quality Control", "Manufacturing Processes", "Lean Manufacturing", "Technical Drawing", "Blueprint Reading", "Surveying",
    "Structural Analysis", "Project Estimation", "Laboratory Skills", "Scientific Writing", "Experimental Design", "Data Collection",
    "Microscopy", "PCR", "Chromatography", "Statistical Analysis", "SPSS", "GIS", "Environmental Compliance", "Safety Regulations",
  ],
  "Skilled trades & operations": [
    "Electrical Wiring", "Plumbing", "HVAC", "Carpentry", "Welding", "Machine Operation", "CNC Machining", "Forklift Operation",
    "Equipment Maintenance", "Preventive Maintenance", "Blueprint Reading", "Power Tools", "Construction Safety", "OSHA Compliance",
    "Painting", "Drywall", "Masonry", "Auto Repair", "Diagnostics", "Landscaping", "Warehouse Operations", "Shipping and Receiving",
    "Inventory Control", "Packing", "Order Picking", "Driving", "CDL License", "Route Planning", "Janitorial", "Cleaning", "Heavy Lifting",
  ],
  "Food service & hospitality": [
    "Food Safety", "ServSafe", "Food Preparation", "Cooking", "Baking", "Barista Skills", "Bartending", "Table Service", "Menu Knowledge",
    "Cash Handling", "Customer Hospitality", "Upselling", "Kitchen Management", "Inventory Management", "Event Catering", "Front Desk",
    "Reservations", "Housekeeping", "Guest Relations", "Concierge Services", "Point of Sale Systems", "Opening and Closing Procedures",
    "Team Coordination", "Fast-Paced Environments", "Sanitation Standards",
  ],
  "Legal & public service": [
    "Legal Research", "Legal Writing", "Contract Drafting", "Case Management", "Document Review", "Westlaw", "LexisNexis", "Compliance",
    "Regulatory Affairs", "Litigation Support", "Paralegal Skills", "Policy Analysis", "Grant Writing", "Fundraising", "Community Outreach",
    "Volunteer Coordination", "Social Services", "Crisis Intervention", "Counseling", "Public Safety", "Report Writing", "Mediation",
  ],
  "Languages": [
    "English", "Spanish", "French", "German", "Portuguese", "Italian", "Mandarin Chinese", "Cantonese", "Japanese", "Korean", "Arabic",
    "Hindi", "Russian", "Bilingual", "Translation", "Interpretation", "Sign Language",
  ],
};

/** Everything, flattened and de-duplicated. */
export const ALL_SKILLS: string[] = Array.from(new Set(Object.values(SKILL_GROUPS).flat()));

/** Shown as one-tap suggestions before the person types anything. */
export const POPULAR_SKILLS: string[] = [
  "Communication", "Teamwork", "Leadership", "Problem Solving", "Time Management", "Customer Service", "Microsoft Excel",
  "Microsoft Office", "Project Management", "Attention to Detail", "Adaptability", "Public Speaking", "Python", "JavaScript", "SQL",
  "Data Analysis", "Social Media Marketing", "Spanish", "Critical Thinking", "Organization",
];
