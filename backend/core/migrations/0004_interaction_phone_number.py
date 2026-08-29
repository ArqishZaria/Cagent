import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_leaduploadtask'),
    ]

    operations = [
        migrations.AddField(
            model_name='interaction',
            name='phone_number',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='interactions',
                to='core.phonenumber',
            ),
        ),
    ]