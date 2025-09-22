export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected' | '';
export type FieldworkStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'finalized';

export interface ReviewComment {
  author: string;
  content: string;
  timestamp: string; // ISO string
}

export interface ARCRow {
  activity: string;
  risk: string;
  control: string;
  testOfControl: string;
  substantiveProcedure: string;
  samplingApplicable: 'Yes' | 'No' | '';
  samplingMethodology:
    | 'Random Sampling'
    | 'Systematic Sampling'
    | 'Stratified Sampling'
    | 'Cluster Sampling'
    | 'Monetary Unit Sampling (MUS)'
    | 'Judgmental Sampling'
    | '';
  controlEffective: 'Yes' | 'No' | '';
  attachments: string;
  auditRemarks: string;
  redFlag: 'Yes' | 'No' | '';
  reportable: 'Yes' | 'No' | '';
  observationRanking: string;
  auditObservation: string;
  effect: string;
  recommendation: string;
  annexure: string;
}

export interface FieldworkRecord {
  controlId: string;
  status: FieldworkStatus;
  progress: number;
  activeTab: number;
  env: {
    alternativeControl: string;
    altControlCategory: 'Preventive' | 'Detective' | 'Corrective' | '';
    responsibility: string;
    riskAssociated: 'Yes' | 'No' | '';
    controlNature: 'Preventive' | 'Detective' | 'Corrective' | '';
  };
  methodology: {
    methodType: 'Test of Control' | 'Substantive Procedure' | '';
    procedure: string;
    verification: 'Sampling' | '100% Verification' | '';
    samplingMethod:
      | 'Random Sampling'
      | 'Systematic Sampling'
      | 'Stratified Sampling'
      | 'Cluster Sampling'
      | 'Monetary Unit Sampling (MUS)'
      | 'Judgmental Sampling'
      | '';
    implementationConclusion: 'Implemented' | 'Not Implemented' | '';
  };
  effectiveness: {
    effectiveness: 'Effective' | 'Ineffective' | 'Not Implemented' | '';
    designConclusion: 'Effective' | 'Ineffective' | 'Not Implemented' | '';
    automated: 'Manual' | 'Automated' | '';
    rating: 'High' | 'Medium' | 'Low' | '';
  };
  remarks: {
    auditRemarks: string;
    reviewComments: string; // latest draft input
    revisedAuditRemarks: string;
    reviewStatus: ReviewStatus;
  };
  report: {
    observation: string;
    observationRanking: 'High' | 'Medium' | 'Low' | '';
    annexure: string;
    riskEffect: string;
    recommendation: string;
  };
  // Risk scoring captured during execution
  risk?: {
    mode: 'single' | 'likelihood_consequence';
    likelihood?: number;
    consequence?: number;
    riskScore: number;
    controlScore: number;
    residualRisk: number;
    riskLevel?: string; // from thresholds
    residualLevel?: string; // from thresholds
    overridden?: boolean;
    overrideValue?: number;
    justification?: string;
    lastCalculatedAt?: string;
  };
  reviewHistory?: ReviewComment[];
  arc?: ARCRow;
}
