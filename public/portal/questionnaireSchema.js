// public/portal/questionnaireSchema.js
// A JS mirror of the Android app's QuestionnaireData.kt — kept in sync
// by hand for now. This is what lets the inspection report show real
// question labels and group answers by section, instead of raw IDs.

const QUESTIONNAIRE_SECTIONS = [
  {
    id: 'general_info', title: 'General School Information', icon: '🏫',
    questions: [
      { id: 'udise_code', label: 'UDISE Code', type: 'TEXT' },
      { id: 'school_category', label: 'School Category', type: 'DROPDOWN' },
      { id: 'has_preprimary', label: 'Does the school have a Pre-Primary section?', type: 'YES_NO' },
      { id: 'medium', label: 'Medium of Instruction', type: 'DROPDOWN' },
      { id: 'management', label: 'Management', type: 'DROPDOWN' },
      { id: 'hm_name', label: 'Headmaster / Headmistress Name', type: 'TEXT' },
      { id: 'hm_phone', label: 'Headmaster / Headmistress Phone', type: 'NUMBER' },
      { id: 'hm_present', label: 'Is the HM himself/herself present?', type: 'YES_NO' },
      { id: 'total_enrolment', label: 'Total Enrolment Across All Classes', type: 'NUMBER' },
      { id: 'total_boys', label: 'Total Boys', type: 'NUMBER' },
      { id: 'total_girls', label: 'Total Girls', type: 'NUMBER' }
    ]
  },
  { id: 'student_attendance', title: 'Student Attendance', icon: '🧑‍🎓', special: 'STUDENT_ATTENDANCE' },
  { id: 'staff_attendance', title: 'Teacher & Staff Attendance', icon: '👨‍🏫', special: 'STAFF_ATTENDANCE' },
  {
    id: 'infrastructure', title: 'Infrastructure', icon: '🏗️',
    questions: [
      { id: 'infra_boundary_wall', label: 'School Boundary Wall', type: 'CHOICE' },
      { id: 'infra_building_condition', label: 'School Building Condition', type: 'CHOICE' },
      { id: 'infra_building_type', label: 'School Building Type', type: 'CHOICE' },
      { id: 'infra_roof_condition', label: 'Roof Condition', type: 'CHOICE' },
      { id: 'infra_roof_leakage', label: 'Roof Leakage/Seepage?', type: 'YES_NO' },
      { id: 'infra_ceiling_condition', label: 'Ceiling Condition', type: 'CHOICE' },
      { id: 'infra_electricity_available', label: 'Electricity Available?', type: 'YES_NO' },
      { id: 'infra_fans_working', label: 'Fans Working', type: 'RATIO_PAIR', sub1: 'Fan Points', sub2: 'Fans Working' },
      { id: 'infra_lights_working', label: 'Lights Working', type: 'RATIO_PAIR', sub1: 'Light Points', sub2: 'Lights Working' },
      { id: 'infra_drinking_water_available', label: 'Drinking Water Available?', type: 'YES_NO',
        revealsOnYes: [
          { id: 'infra_drinking_water_source', label: 'Source of Drinking Water', type: 'DROPDOWN' },
          { id: 'infra_water_quality', label: 'Water Quality', type: 'DROPDOWN' }
        ] },
      { id: 'infra_separate_toilets', label: 'Separate Toilets for Boys and Girls?', type: 'YES_NO' },
      { id: 'infra_toilets_functional', label: 'Toilets Functional?', type: 'YES_NO' },
      { id: 'infra_handwashing', label: 'Handwashing Facility Available?', type: 'YES_NO' },
      { id: 'infra_ramp_available', label: 'Ramp Available?', type: 'YES_NO' },
      { id: 'infra_playground_available', label: 'Playground Available?', type: 'YES_NO' },
      { id: 'infra_library_available', label: 'Library Available?', type: 'YES_NO' },
      { id: 'infra_science_lab_available', label: 'Science Laboratory Available?', type: 'YES_NO' },
      { id: 'infra_sports_equipment_available', label: 'Sports Equipment Available?', type: 'YES_NO' }
    ]
  },
  {
    id: 'classrooms', title: 'Classroom Observation', icon: '📚',
    questions: [
      { id: 'classroom_count', label: 'No. of Classrooms Available', type: 'NUMBER' },
      { id: 'classroom_cleanliness', label: 'Classrooms Cleanliness', type: 'CHOICE' },
      { id: 'classes_running', label: 'Classes are Running During Visit?', type: 'YES_NO' },
      { id: 'blackboards_every_class', label: 'Blackboards/Whiteboards in Every Class?', type: 'YES_NO' },
      { id: 'lesson_plan_available', label: 'Lesson Plan Available?', type: 'YES_NO' },
      { id: 'class_discipline', label: 'Class Discipline', type: 'CHOICE' },
      { id: 'merged_classes', label: 'Any Merged Classes Being Conducted?', type: 'YES_NO',
        revealsOnYes: [{ id: 'merged_classes_which', label: 'Which classes?', type: 'TEXT' }] },
      { id: 'furniture_adequate_new', label: 'Adequate Furnitures Available?', type: 'YES_NO',
        revealsOnNo: [{ id: 'furniture_shortage_detail', label: 'Shortages', type: 'MULTILINE_TEXT' }] }
    ]
  },
  {
    id: 'pm_poshan', title: 'Mid Day Meal — PM POSHAN', icon: '🍽️',
    questions: [
      { id: 'mdm_prepared_today', label: 'Meal Prepared Today', type: 'YES_NO' },
      { id: 'mdm_served_today', label: 'Meal Served', type: 'YES_NO' },
      { id: 'mdm_menu_followed', label: 'Menu Followed', type: 'YES_NO' },
      { id: 'mdm_food_quality', label: 'Food Quality', type: 'CHOICE' },
      { id: 'mdm_kitchen_cleanliness', label: 'Kitchen Cleanliness', type: 'CHOICE' },
      { id: 'mdm_dining_room_available', label: 'Dining Room Available?', type: 'YES_NO',
        revealsOnYes: [{ id: 'mdm_dining_area_cleanliness', label: 'Dining Area Cleanliness', type: 'CHOICE' }] },
      { id: 'mdm_cook_present', label: 'Cook Present', type: 'YES_NO' },
      { id: 'mdm_food_stock_register', label: 'Food Stock Register Updated', type: 'YES_NO' }
    ]
  },
  {
    id: 'academic_performance', title: 'Academic Performance', icon: '📖',
    questions: [
      { id: 'academic_learning_outcome', label: 'Learning Outcome Satisfactory', type: 'CHOICE' },
      { id: 'academic_reading_ability', label: 'Students Reading Ability', type: 'CHOICE',
        extra: { id: 'academic_reading_names', label: 'Students tested (name, class, roll no.)', type: 'MULTILINE_TEXT' } },
      { id: 'academic_writing_ability', label: 'Students Writing Ability', type: 'CHOICE',
        extra: { id: 'academic_writing_names', label: 'Students tested (name, class, roll no.)', type: 'MULTILINE_TEXT' } },
      { id: 'academic_math_understanding', label: 'Mathematics Understanding', type: 'CHOICE',
        extra: { id: 'academic_math_names', label: 'Students tested (name, class, roll no.)', type: 'MULTILINE_TEXT' } },
      { id: 'academic_special_educator', label: 'Special Educator Available?', type: 'YES_NO' }
    ]
  },
  {
    id: 'records_registers', title: 'Records and Registers', icon: '📋',
    questions: [
      { id: 'rec_admission_register', label: 'Admission Register', type: 'CHOICE' },
      { id: 'rec_stock_register', label: 'Stock Register', type: 'CHOICE' },
      { id: 'rec_cash_book', label: 'Cash Book', type: 'CHOICE' },
      { id: 'rec_inspection_visitors_register', label: 'Inspection and Visitors Register', type: 'CHOICE' },
      { id: 'rec_smc_register', label: 'SMC Register', type: 'CHOICE' },
      { id: 'rec_students_attendance_register', label: 'Students Attendance Register', type: 'CHOICE' },
      { id: 'rec_students_attendance_remarks', label: 'Remarks on Students Attendance Register', type: 'MULTILINE_TEXT' },
      { id: 'rec_staff_attendance_register', label: 'Staff Attendance Register', type: 'CHOICE' }
    ]
  },
  {
    id: 'digital_facilities', title: 'Digital Facilities', icon: '💻',
    questions: [
      { id: 'digital_internet_available', label: 'Internet Available?', type: 'YES_NO' },
      { id: 'digital_smart_classroom', label: 'Smart Classroom Available?', type: 'YES_NO' },
      { id: 'digital_projector_available', label: 'Projector Available?', type: 'YES_NO' },
      { id: 'digital_ict_lab_available', label: 'ICT Lab Available?', type: 'YES_NO' },
      { id: 'digital_computers_functional', label: 'Computers Functional?', type: 'YES_NO' }
    ]
  },
  {
    id: 'safety_security', title: 'Safety and Security', icon: '🧯',
    questions: [
      { id: 'safety_fire_extinguisher', label: 'Fire Extinguisher Available?', type: 'YES_NO',
        revealsOnYes: [{ id: 'safety_fire_extinguisher_valid', label: 'Fire Extinguisher Valid?', type: 'YES_NO' }] },
      { id: 'safety_first_aid_box', label: 'First Aid Box Available?', type: 'YES_NO' },
      { id: 'safety_cctv_installed', label: 'CCTV Installed?', type: 'YES_NO' }
    ]
  },
  {
    id: 'compliance_issues', title: 'Compliance and Issues Found', icon: '⚠️',
    questions: [
      { id: 'compliance_previous_inspection', label: 'Previous Inspection Conducted?', type: 'YES_NO' },
      { id: 'compliance_deficiencies_rectified', label: 'Previous Deficiencies Rectified', type: 'CHOICE' },
      { id: 'compliance_issues_found', label: 'Any Issues Found?', type: 'YES_NO',
        revealsOnYes: [
          { id: 'compliance_issue_description', label: 'Description of the Issue', type: 'MULTILINE_TEXT' },
          { id: 'compliance_suggested_action', label: 'Suggested Action', type: 'MULTILINE_TEXT' }
        ] }
    ]
  },
  { id: 'photos', title: 'Photos', icon: '📷', special: 'PHOTOS' },
  {
    id: 'overall_grading', title: 'Overall Grading', icon: '🏆', special: 'GRADING',
    questions: [
      { id: 'grade_infrastructure', label: 'Infrastructure', type: 'NUMBER' },
      { id: 'grade_academics', label: 'Academics', type: 'NUMBER' },
      { id: 'grade_administration', label: 'Administration', type: 'NUMBER' },
      { id: 'grade_premises_cleanliness', label: 'Premises Cleanliness', type: 'NUMBER' },
      { id: 'grade_hygiene', label: 'Hygiene', type: 'NUMBER' },
      { id: 'grade_discipline', label: 'Discipline', type: 'NUMBER' },
      { id: 'grade_attendance', label: 'Attendance', type: 'NUMBER' }
    ]
  },
  {
    id: 'final_remarks_signature', title: 'Final Remarks & Signature', icon: '✍️', special: 'SIGNATURE',
    questions: [{ id: 'final_remarks', label: 'Final Remarks', type: 'MULTILINE_TEXT' }]
  }
  // "review_submit" is a meta section with no real data of its own — skipped here.
];
