from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_contactsubmission'),
    ]

    operations = [
        migrations.AlterField(
            model_name='supportmessage',
            name='message',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='supportmessage',
            name='attachment',
            field=models.FileField(blank=True, help_text='Optional proof — e.g. a bank/SadaPay transfer screenshot.', null=True, upload_to='support_attachments/'),
        ),
    ]