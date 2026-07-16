// routes/questionnaireSeed.js
// The exact structure the Android app currently has hardcoded into
// QuestionnaireData.kt, transcribed here so it can be seeded into the
// new questionnaire_builder tables as the first scheme ("School
// Inspection"). This is what Phase 1 gives the DM something real to
// look at and edit, rather than an empty shell — and it's what Phase 2
// will eventually have the app fetch from directly, once that's built.

const SCHOOL_SCHEME_SEED = {
  code: 'school',
  name: 'School Inspection',
  description: 'Inspection and monitoring of schools under the Education Department.',
  sections: [
    {
      key: 'general_info', title: 'General School Information', icon: '🏫',
      questions: [
        { key: 'udise_code', label: 'UDISE Code', type: 'TEXT' },
        { key: 'school_category', label: 'School Category', type: 'DROPDOWN', options: ['Junior Basic School', 'Senior Basic School', 'High School', 'Higher Secondary School'] },
        { key: 'has_preprimary', label: 'Does the school have a Pre-Primary section?', type: 'YES_NO' },
        { key: 'medium', label: 'Medium of Instruction', type: 'DROPDOWN', options: ['Bengali', 'English', 'Others'] },
        { key: 'management', label: 'Management', type: 'DROPDOWN', options: ['Government', 'Government Aided', 'Private'] },
        { key: 'hm_name', label: 'Headmaster / Headmistress Name', type: 'TEXT' },
        { key: 'hm_phone', label: 'Headmaster / Headmistress Phone', type: 'NUMBER' },
        { key: 'hm_present', label: 'Is the HM himself/herself present?', type: 'YES_NO' },
        { key: 'total_enrolment', label: 'Total Enrolment Across All Classes', type: 'NUMBER' },
        { key: 'total_boys', label: 'Total Boys', type: 'NUMBER' },
        { key: 'total_girls', label: 'Total Girls', type: 'NUMBER' }
      ]
    },
    { key: 'student_attendance', title: 'Student Attendance', icon: '🧑‍🎓', special_type: 'STUDENT_ATTENDANCE', questions: [] },
    { key: 'staff_attendance', title: 'Teacher & Staff Attendance', icon: '👨‍🏫', special_type: 'STAFF_ATTENDANCE', questions: [] },
    {
      key: 'infrastructure', title: 'Infrastructure', icon: '🏗️',
      questions: [
        { key: 'infra_boundary_wall', label: 'School Boundary Wall', type: 'CHOICE', options: ['Good', 'Average', 'Poor', 'Absent'] },
        { key: 'infra_building_condition', label: 'School Building Condition', type: 'CHOICE', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
        { key: 'infra_building_type', label: 'School Building Type', type: 'CHOICE', options: ['Pucca with CC Roof', 'Pucca with ACI Roof', 'Others'] },
        { key: 'infra_roof_condition', label: 'Roof Condition', type: 'CHOICE', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
        { key: 'infra_roof_leakage', label: 'Is there any leakage/seepage in the Roof?', type: 'YES_NO' },
        { key: 'infra_ceiling_condition', label: 'Ceiling Condition', type: 'CHOICE', options: ['Good', 'Fair', 'Poor', 'Not Applicable'] },
        { key: 'infra_electricity_available', label: 'Electricity Available?', type: 'YES_NO' },
        { key: 'infra_fans_working', label: 'Fans Working', type: 'RATIO_PAIR', subLabel1: 'No. of Fan Points', subLabel2: 'No. of Fans Working' },
        { key: 'infra_lights_working', label: 'Lights Working', type: 'RATIO_PAIR', subLabel1: 'No. of Light Points', subLabel2: 'No. of Lights Working' },
        {
          key: 'infra_drinking_water_available', label: 'Drinking Water Available?', type: 'YES_NO',
          revealsOnYes: [
            { key: 'infra_drinking_water_source', label: 'Source of Drinking Water', type: 'DROPDOWN', options: ['Tap Water', 'Ground Water', 'Surface Water', 'Commercial/Packaged', 'Others'] },
            { key: 'infra_water_quality', label: 'Water Quality', type: 'DROPDOWN', options: ['Good', 'Average', 'Poor'] }
          ]
        },
        { key: 'infra_separate_toilets', label: 'Separate Toilets for Boys and Girls?', type: 'YES_NO' },
        { key: 'infra_toilets_functional', label: 'Toilets Functional?', type: 'YES_NO' },
        { key: 'infra_handwashing', label: 'Handwashing Facility Available?', type: 'YES_NO' },
        { key: 'infra_ramp_available', label: 'Ramp Available?', type: 'YES_NO' },
        { key: 'infra_playground_available', label: 'Playground Available?', type: 'YES_NO' },
        { key: 'infra_library_available', label: 'Library Available?', type: 'YES_NO' },
        { key: 'infra_science_lab_available', label: 'Science Laboratory Available?', type: 'YES_NO' },
        { key: 'infra_sports_equipment_available', label: 'Sports Equipment Available?', type: 'YES_NO' }
      ]
    },
    {
      key: 'classrooms', title: 'Classroom Observation', icon: '📚',
      questions: [
        { key: 'classroom_count', label: 'No. of Classrooms Available', type: 'NUMBER' },
        { key: 'classroom_cleanliness', label: 'Classrooms Cleanliness', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'] },
        { key: 'classes_running', label: 'Classes are Running During Visit?', type: 'YES_NO' },
        { key: 'blackboards_every_class', label: 'Blackboards/Whiteboards Available in Every Class?', type: 'YES_NO' },
        { key: 'lesson_plan_available', label: 'Lesson Plan Available?', type: 'YES_NO' },
        { key: 'class_discipline', label: 'Class Discipline', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'] },
        {
          key: 'merged_classes', label: 'Whether any merged classes are being conducted (i.e. more than one class in a single classroom at the same time)?', type: 'YES_NO',
          revealsOnYes: [{ key: 'merged_classes_which', label: 'If Yes, which classes? (e.g. Class I and Class II)', type: 'TEXT' }]
        },
        {
          key: 'furniture_adequate_new', label: 'Adequate Furnitures Available?', type: 'YES_NO',
          revealsOnNo: [{ key: 'furniture_shortage_detail', label: 'If No, please specify what are the shortages (e.g. 2 wooden chair, 10 bench, 2 Almirah etc.)', type: 'MULTILINE_TEXT' }]
        }
      ]
    },
    {
      key: 'pm_poshan', title: 'Mid Day Meal - PM POSHAN', icon: '🍽️',
      questions: [
        { key: 'mdm_prepared_today', label: 'Meal Prepared Today', type: 'YES_NO' },
        { key: 'mdm_served_today', label: 'Meal Served', type: 'YES_NO' },
        { key: 'mdm_menu_followed', label: 'Menu Followed', type: 'YES_NO' },
        { key: 'mdm_food_quality', label: 'Food Quality', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'] },
        { key: 'mdm_kitchen_cleanliness', label: 'Kitchen Cleanliness', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'] },
        {
          key: 'mdm_dining_room_available', label: 'Dining Room Available?', type: 'YES_NO',
          revealsOnYes: [{ key: 'mdm_dining_area_cleanliness', label: 'Dining Area Cleanliness', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'] }]
        },
        { key: 'mdm_cook_present', label: 'Cook Present', type: 'YES_NO' },
        { key: 'mdm_food_stock_register', label: 'Food Stock Register Updated', type: 'YES_NO' }
      ]
    },
    {
      key: 'academic_performance', title: 'Academic Performance', icon: '📖',
      questions: [
        { key: 'academic_learning_outcome', label: 'Learning Outcome Satisfactory', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'] },
        { key: 'academic_reading_ability', label: 'Students Reading Ability', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'], extraTextField: { key: 'academic_reading_names', label: 'Name, Class and Roll Number of Students on whom Reading ability tested', type: 'MULTILINE_TEXT' } },
        { key: 'academic_writing_ability', label: 'Students Writing Ability', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'], extraTextField: { key: 'academic_writing_names', label: 'Name, Class and Roll Number of Students on whom Writing ability tested', type: 'MULTILINE_TEXT' } },
        { key: 'academic_math_understanding', label: 'Mathematics Understanding', type: 'CHOICE', options: ['Excellent', 'Good', 'Average', 'Poor'], extraTextField: { key: 'academic_math_names', label: 'Name, Class and Roll Number of Students on whom Mathematics Understanding tested', type: 'MULTILINE_TEXT' } },
        { key: 'academic_special_educator', label: 'Special Educator Available?', type: 'YES_NO' }
      ]
    },
    {
      key: 'records_registers', title: 'Records and Registers', icon: '📋',
      questions: [
        { key: 'rec_admission_register', label: 'Admission Register', type: 'CHOICE', options: ['Updated', 'Not Updated'] },
        { key: 'rec_stock_register', label: 'Stock Register', type: 'CHOICE', options: ['Updated', 'Not Updated'] },
        { key: 'rec_cash_book', label: 'Cash Book', type: 'CHOICE', options: ['Updated', 'Not Updated', 'Not Available'] },
        { key: 'rec_inspection_visitors_register', label: 'Inspection and Visitors Register', type: 'CHOICE', options: ['Updated', 'Not Updated'] },
        { key: 'rec_smc_register', label: 'SMC Register', type: 'CHOICE', options: ['Updated', 'Not Updated'] },
        { key: 'rec_students_attendance_register', label: 'Students Attendance Register', type: 'CHOICE', options: ['Updated', 'Not Updated'] },
        { key: 'rec_students_attendance_remarks', label: 'Remarks on Students Attendance Register (if any)', type: 'MULTILINE_TEXT' },
        { key: 'rec_staff_attendance_register', label: 'Teaching & Non-Teaching Staff Attendance Register', type: 'CHOICE', options: ['Updated', 'Not Updated'] }
      ]
    },
    {
      key: 'digital_facilities', title: 'Digital Facilities', icon: '💻',
      questions: [
        { key: 'digital_internet_available', label: 'Internet Available?', type: 'YES_NO' },
        { key: 'digital_smart_classroom', label: 'Smart Classroom Available?', type: 'YES_NO' },
        { key: 'digital_projector_available', label: 'Projector Available?', type: 'YES_NO' },
        { key: 'digital_ict_lab_available', label: 'ICT Lab Available?', type: 'YES_NO' },
        { key: 'digital_computers_functional', label: 'Computers Functional?', type: 'YES_NO' }
      ]
    },
    {
      key: 'safety_security', title: 'Safety and Security', icon: '🧯',
      questions: [
        {
          key: 'safety_fire_extinguisher', label: 'Fire Extinguisher Available?', type: 'YES_NO',
          revealsOnYes: [{ key: 'safety_fire_extinguisher_valid', label: 'Fire Extinguisher Valid?', type: 'YES_NO' }]
        },
        { key: 'safety_first_aid_box', label: 'First Aid Box Available?', type: 'YES_NO' },
        { key: 'safety_cctv_installed', label: 'CCTV Installed?', type: 'YES_NO' }
      ]
    },
    {
      key: 'compliance_issues', title: 'Compliance and Issues Found', icon: '⚠️',
      questions: [
        { key: 'compliance_previous_inspection', label: 'Previous Inspection Conducted?', type: 'YES_NO' },
        { key: 'compliance_deficiencies_rectified', label: 'Previous Deficiencies Rectified', type: 'CHOICE', options: ['Yes', 'No', 'Partially'] },
        {
          key: 'compliance_issues_found', label: 'Any Issues Found?', type: 'YES_NO',
          revealsOnYes: [
            { key: 'compliance_issue_description', label: 'Description of the Issue', type: 'MULTILINE_TEXT' },
            { key: 'compliance_suggested_action', label: 'Suggested Action', type: 'MULTILINE_TEXT' }
          ]
        }
      ]
    },
    { key: 'photos', title: 'Photos', icon: '📷', special_type: 'PHOTOS', questions: [] },
    {
      key: 'overall_grading', title: 'Overall Grading and Final Observations', icon: '🏆',
      questions: [
        { key: 'grade_infrastructure', label: 'Infrastructure (out of 10)', type: 'NUMBER' },
        { key: 'grade_academics', label: 'Academics (out of 10)', type: 'NUMBER' },
        { key: 'grade_administration', label: 'Administration (out of 10)', type: 'NUMBER' },
        { key: 'grade_premises_cleanliness', label: 'School Premises Cleanliness (out of 10)', type: 'NUMBER' },
        { key: 'grade_hygiene', label: 'Hygiene (out of 10)', type: 'NUMBER' },
        { key: 'grade_discipline', label: 'Discipline (out of 10)', type: 'NUMBER' },
        { key: 'grade_attendance', label: 'Attendance (out of 10)', type: 'NUMBER' }
      ]
    },
    {
      key: 'final_remarks_signature', title: 'Final Remarks & Signature', icon: '✍️',
      questions: [{ key: 'final_remarks', label: 'Final Remarks (if any)', type: 'MULTILINE_TEXT' }]
    },
    { key: 'review_submit', title: 'Review & Final Submit', icon: '✅', special_type: 'REVIEW', questions: [] }
  ]
};

module.exports = { SCHOOL_SCHEME_SEED };
