import { inferNotificationCategory, EMAIL_ALLOWED_SQL } from '../../src/domain/notifications/services/notificationCategories';

describe('notification categories', () => {
  it('maps every notification type to its preference category', () => {
    expect(inferNotificationCategory('deadline_near')).toBe('deadline');
    expect(inferNotificationCategory('admission_verified')).toBe('verification');
    expect(inferNotificationCategory('admission_rejected')).toBe('verification');
    expect(inferNotificationCategory('admission_revision_required')).toBe('verification');
    expect(inferNotificationCategory('system_broadcast')).toBe('system');
    expect(inferNotificationCategory('system_error')).toBe('system');
    expect(inferNotificationCategory('admission_updated_saved')).toBe('update');
  });

  it('email retry SQL checks both the email switch and the category', () => {
    expect(EMAIL_ALLOWED_SQL).toContain('email_notifications_enabled');
    expect(EMAIL_ALLOWED_SQL).toContain("WHEN n.notification_type = 'deadline_near' THEN 'deadline'");
    expect(EMAIL_ALLOWED_SQL).toContain("'admission_verified', 'admission_rejected', 'admission_revision_required'");
  });
});
