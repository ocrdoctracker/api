export const READ_SUCCESS = 'Notification marked as read!';

export const REQUEST_NOTIF = {
  PENDING: {
    title: "New Document Request Assigned",
    description: "A new document request #{requestId} has been assigned to your department. Review and take action",
  },
  APPROVED: {
    title: "Request Approved",
    description: "Your request #{requestId} has been approved by {departmentName}. Processing will begin soon.",
  },
  PROCESSING: {
    title: "Request in Processing",
    description: "Your request #{requestId} is now being processed by {departmentName}.",
  },
  REJECTED: {
    title: "Request Rejected",
    description: "Your request #{requestId} was rejected by {departmentName}. Check remarks for details",
  },
  CANCELLED: {
    title: "Request Cancelled",
    description: "Request #{requestId} has been cancelled. The process has been stopped and no further action is required.",
  },
  COMPLETED: {
    title: "Request Completed",
    description: "Your request #{requestId} is completed. You may now claim or download your document.",
  },
  CLOSED: {
    title: "Request Closed",
    description: "Request #{requestId} has been closed. The process is complete and no further actions are needed.",
  },
  UPLOADED: {
    title: "Document Uploaded",
    description: "The document for request #{requestId} has been uploaded. You can now view or download it.",
  },
}